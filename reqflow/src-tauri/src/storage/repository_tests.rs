use super::{create_table, create_table_for_test, initialize_blank_project, load_snapshot};
use crate::storage::connection::ProjectManifest;
use crate::storage::migrations::{apply_pending_migrations, configure_connection};
use crate::storage::undo::{UndoAction, UndoStack};
use crate::storage::record_repository::{self, CellUpdate, NewRecord};
use crate::storage::field_repository;
use std::collections::HashMap;
use serde_json::json;
use crate::storage::{lifecycle, table_backup};

fn database() -> (rusqlite::Connection, ProjectManifest) {
    let mut connection = rusqlite::Connection::open_in_memory().expect("database");
    configure_connection(&connection).expect("configure");
    apply_pending_migrations(&mut connection, None).expect("migrate");
    let manifest = ProjectManifest {
        id: "project".to_string(),
        name: "测试项目".to_string(),
        format_version: 1,
        created_at: "1".to_string(),
        updated_at: "1".to_string(),
    };
    initialize_blank_project(&mut connection, &manifest).expect("blank project");
    (connection, manifest)
}

#[test]
fn blank_project_has_one_title_field_and_table_view() {
    let (connection, manifest) = database();
    let snapshot = load_snapshot(&connection, &manifest).expect("snapshot");
    assert_eq!(snapshot.tables.len(), 1);
    assert_eq!(snapshot.tables[0].views[0].view_type, "table");
    assert_eq!(snapshot.tables[0].record_count, 0);
}

#[test]
fn failed_table_transaction_leaves_no_partial_table() {
    let (mut connection, manifest) = database();
    let result = create_table_for_test(&mut connection, "失败表", true);
    assert!(result.is_err());
    let snapshot = load_snapshot(&connection, &manifest).expect("snapshot");
    assert_eq!(snapshot.tables.len(), 1);
    let count: i64 = connection
        .query_row("SELECT COUNT(*) FROM fields", [], |row| row.get(0))
        .expect("fields");
    assert_eq!(count, 1);
}

#[test]
fn table_creation_produces_undoable_minimal_model() {
    let (mut connection, manifest) = database();
    let created = create_table(&mut connection, "第二张表").expect("table");
    assert_eq!(created.views.len(), 1);
    let snapshot = load_snapshot(&connection, &manifest).expect("snapshot");
    assert_eq!(snapshot.tables.len(), 2);
    super::delete_table(&mut connection, &created.id).expect("delete");
    assert_eq!(
        load_snapshot(&connection, &manifest)
            .expect("snapshot")
            .tables
            .len(),
        1
    );
}

#[test]
fn undo_removes_the_created_table_and_keeps_the_default_table() {
    let (mut connection, manifest) = database();
    let created = create_table(&mut connection, "可撤销表").expect("table");
    let mut undo = UndoStack::default();
    undo.push(UndoAction::DeleteTable {
        table_id: created.id,
    });

    undo.undo(&mut connection).expect("undo");

    let snapshot = load_snapshot(&connection, &manifest).expect("snapshot");
    assert_eq!(snapshot.tables.len(), 1);
    assert_eq!(snapshot.tables[0].name, "未命名表");
}

#[test]
fn batch_mutation_is_atomic_and_undo_restores_changed_and_created_records() {
    let (mut connection, manifest) = database();
    let table = load_snapshot(&connection, &manifest).expect("snapshot").tables[0].clone();
    let mut first = HashMap::new();
    first.insert(table.title_field_id.clone(), json!("原始记录"));
    let record_id = record_repository::create_record(&mut connection, &table.id, first).expect("record");

    let mut invalid = HashMap::new();
    invalid.insert(table.title_field_id.clone(), json!(""));
    let failed = record_repository::apply_batch_mutation(
        &mut connection,
        &table.id,
        vec![CellUpdate { record_id: record_id.clone(), field_id: table.title_field_id.clone(), value: json!("不应写入") }],
        vec![NewRecord { values: invalid }],
        vec![],
    );
    assert!(failed.is_err());
    let unchanged = field_repository::load_table_data(&connection, &table.id).expect("data");
    assert_eq!(unchanged.records[0].values[&table.title_field_id], json!("原始记录"));

    let mut second = HashMap::new();
    second.insert(table.title_field_id.clone(), json!("新记录"));
    let backup = record_repository::apply_batch_mutation(
        &mut connection,
        &table.id,
        vec![CellUpdate { record_id, field_id: table.title_field_id.clone(), value: json!("已修改") }],
        vec![NewRecord { values: second }],
        vec![],
    ).expect("batch");
    let after = field_repository::load_table_data(&connection, &table.id).expect("data");
    assert_eq!(after.records.len(), 2);
    record_repository::restore_batch_mutation(&mut connection, &backup).expect("undo batch");
    let restored = field_repository::load_table_data(&connection, &table.id).expect("data");
    assert_eq!(restored.records.len(), 1);
    assert_eq!(restored.records[0].values[&table.title_field_id], json!("原始记录"));
}

#[test]
fn clearing_an_existing_title_cell_is_allowed_after_record_creation() {
    let (mut connection, manifest) = database();
    let table = load_snapshot(&connection, &manifest).expect("snapshot").tables[0].clone();
    let mut values = HashMap::new();
    values.insert(table.title_field_id.clone(), json!("待清空标题"));
    let record_id = record_repository::create_record(&mut connection, &table.id, values).expect("record");
    record_repository::update_cell(&mut connection, &record_id, &table.title_field_id, serde_json::Value::Null).expect("clear title");
    let data = field_repository::load_table_data(&connection, &table.id).expect("data");
    assert_eq!(data.records[0].values[&table.title_field_id], serde_json::Value::Null);
}

#[test]
fn opening_a_project_with_no_title_field_is_rejected_as_corrupt() {
    let (connection, _manifest) = database();
    connection
        .execute("DELETE FROM fields WHERE is_title = 1", [])
        .expect("delete title");

    let error = crate::storage::validation::validate_project_structure(&connection)
        .expect_err("corrupt project");
    assert_eq!(
        error.code,
        crate::storage::error::StorageErrorCode::DatabaseCorrupt
    );
}

#[test]
fn table_and_view_lifecycle_preserves_minimal_structure_and_order() {
    let (mut connection, manifest) = database();
    let first_id = load_snapshot(&connection, &manifest)
        .expect("snapshot")
        .tables[0]
        .id
        .clone();
    let second = create_table(&mut connection, "第二张表").expect("table");
    lifecycle::rename_table(&mut connection, &second.id, "交付表").expect("rename table");
    lifecycle::create_view(&mut connection, &second.id, "看板", "board").expect("view");
    lifecycle::duplicate_view(&mut connection, &second.views[0].id, "表格副本")
        .expect("duplicate view");

    let snapshot = load_snapshot(&connection, &manifest).expect("snapshot");
    let second_snapshot = snapshot
        .tables
        .iter()
        .find(|table| table.id == second.id)
        .expect("second table");
    assert_eq!(second_snapshot.name, "交付表");
    assert_eq!(second_snapshot.views.len(), 3);
    let view_ids: Vec<String> = second_snapshot
        .views
        .iter()
        .rev()
        .map(|view| view.id.clone())
        .collect();
    lifecycle::reorder_views(&mut connection, &second.id, &view_ids).expect("reorder views");
    lifecycle::reorder_tables(&mut connection, &[second.id.clone(), first_id])
        .expect("reorder tables");

    let reordered = load_snapshot(&connection, &manifest).expect("snapshot");
    assert_eq!(reordered.tables[0].id, second.id);
    assert_eq!(reordered.tables[0].views[0].id, view_ids[0]);
}

#[test]
fn deleting_and_restoring_table_restores_fields_views_and_config() {
    let (mut connection, manifest) = database();
    let created = create_table(&mut connection, "可恢复表").expect("table");
    lifecycle::create_view(&mut connection, &created.id, "看板", "board").expect("view");

    let deleted = table_backup::delete_table(&mut connection, &created.id).expect("delete");
    assert_eq!(
        load_snapshot(&connection, &manifest)
            .expect("snapshot")
            .tables
            .len(),
        1
    );
    table_backup::restore_table(&mut connection, &deleted).expect("restore");

    let restored = load_snapshot(&connection, &manifest).expect("snapshot");
    let table = restored
        .tables
        .iter()
        .find(|item| item.name == "可恢复表")
        .expect("restored table");
    assert_eq!(table.views.len(), 2);
    let config_count: i64 = connection.query_row("SELECT COUNT(*) FROM view_configs WHERE view_id IN (SELECT id FROM views WHERE table_id = ?1)", [&table.id], |row| row.get(0)).expect("configs");
    assert_eq!(config_count, 2);
}

#[test]
fn lifecycle_rejects_duplicate_names_and_last_table_or_view_deletion() {
    let (mut connection, manifest) = database();
    let table = create_table(&mut connection, "第二张表").expect("table");
    let duplicate = lifecycle::rename_table(&mut connection, &table.id, "未命名表");
    assert!(duplicate.is_err());
    let default_view = load_snapshot(&connection, &manifest)
        .expect("snapshot")
        .tables[0]
        .views[0]
        .id
        .clone();
    let last_view = lifecycle::delete_view(&mut connection, &default_view);
    assert!(last_view.is_err());
    let default_table = load_snapshot(&connection, &manifest)
        .expect("snapshot")
        .tables[0]
        .id
        .clone();
    table_backup::delete_table(&mut connection, &table.id).expect("delete second");
    assert!(table_backup::delete_table(&mut connection, &default_table).is_err());
}

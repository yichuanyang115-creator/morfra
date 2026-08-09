use super::{create_table, create_table_for_test, initialize_blank_project, load_snapshot};
use crate::storage::connection::ProjectManifest;
use crate::storage::migrations::{apply_pending_migrations, configure_connection};

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

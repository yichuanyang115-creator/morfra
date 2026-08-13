use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::connection::{timestamp, ProjectManifest};
use super::error::{StorageError, StorageErrorCode};

pub use super::table_backup::delete_table;

static NEXT_ID: AtomicU64 = AtomicU64::new(1);
const REQUIREMENT_DETAIL_TABS: &str = r#"[{"id":"body","name":"正文","renderer":"body","visible":true},{"id":"deliverables","name":"产出","renderer":"deliverables","visible":true},{"id":"tasks","name":"任务","renderer":"tasks","visible":true},{"id":"acceptance","name":"验收","renderer":"acceptance","visible":true},{"id":"activity","name":"活动","renderer":"activity","visible":true}]"#;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub manifest: ProjectManifest,
    pub tables: Vec<TableSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TableSummary {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub position: i64,
    pub title_field_id: String,
    pub record_count: i64,
    pub views: Vec<ViewSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ViewSummary {
    pub id: String,
    pub name: String,
    pub view_type: String,
    pub position: i64,
}

pub fn initialize_blank_project(
    connection: &mut Connection,
    manifest: &ProjectManifest,
) -> Result<ProjectSnapshot, StorageError> {
    let transaction = connection.transaction()?;
    transaction.execute(
        "INSERT INTO project_meta (id, project_id, name, format_version, created_at, updated_at)
         VALUES ('project', ?1, ?2, ?3, ?4, ?5)",
        (
            &manifest.id,
            &manifest.name,
            manifest.format_version,
            &manifest.created_at,
            &manifest.updated_at,
        ),
    )?;

    let table_id = new_id("table");
    insert_table_row(&transaction, &table_id, "未命名表", 0)?;
    insert_table_defaults(&transaction, &table_id)?;
    transaction.commit()?;
    load_snapshot(connection, manifest)
}

pub fn apply_requirement_template(
    connection: &mut Connection,
    manifest: &ProjectManifest,
    table_id: &str,
) -> Result<ProjectSnapshot, StorageError> {
    let transaction = connection.transaction()?;
    let now = timestamp();
    let stage_id = new_id("field");
    transaction.execute("INSERT INTO fields (id, table_id, name, field_type, is_title, position, config_json, created_at, updated_at) VALUES (?1, ?2, '阶段', 'select', 0, 1, '{\"allowCreate\":true}', ?3, ?3)", (&stage_id, table_id, &now))?;
    for (position, (name, color)) in [("待处理", "gray"), ("进行中", "blue"), ("已完成", "green")]
        .iter()
        .enumerate()
    {
        transaction.execute("INSERT INTO field_options (id, field_id, name, color, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)", (new_id("option"), &stage_id, name, color, position as i64, &now))?;
    }
    let priority_id = new_id("field");
    transaction.execute("INSERT INTO fields (id, table_id, name, field_type, is_title, position, config_json, created_at, updated_at) VALUES (?1, ?2, '优先级', 'select', 0, 2, '{\"allowCreate\":true}', ?3, ?3)", (&priority_id, table_id, &now))?;
    let board_id = new_id("view");
    transaction.execute("INSERT INTO views (id, table_id, name, view_type, position, created_at, updated_at) VALUES (?1, ?2, '看板', 'board', 1, ?3, ?3)", (&board_id, table_id, &now))?;
    transaction.execute("INSERT INTO view_configs (view_id, version, config_json, created_at, updated_at) VALUES (?1, 1, ?2, ?3, ?3)", (&board_id, serde_json::json!({"board":{"groupFieldId":stage_id}}).to_string(), &now))?;
    transaction.execute("UPDATE table_configs SET activity_field_id = ?1, activity_tab_enabled = 1, detail_tabs_json = ?2, updated_at = ?3 WHERE table_id = ?4", (&stage_id, REQUIREMENT_DETAIL_TABS, &now, table_id))?;
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    transaction.commit()?;
    load_snapshot(connection, manifest)
}

pub fn validate_project_identity(
    connection: &Connection,
    manifest: &ProjectManifest,
) -> Result<(), StorageError> {
    let stored: Option<(String, String, i64)> = connection
        .query_row(
            "SELECT project_id, name, format_version FROM project_meta WHERE id = 'project'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()?;
    let Some((project_id, name, format_version)) = stored else {
        return Err(StorageError::new(
            StorageErrorCode::InvalidProjectManifest,
            "数据库缺少有效的项目身份信息",
            false,
        ));
    };
    if project_id != manifest.id
        || name != manifest.name
        || format_version != i64::from(manifest.format_version)
    {
        return Err(StorageError::new(
            StorageErrorCode::InvalidProjectManifest,
            "项目元信息与数据库身份不一致",
            false,
        ));
    }
    Ok(())
}

pub fn load_snapshot(
    connection: &Connection,
    manifest: &ProjectManifest,
) -> Result<ProjectSnapshot, StorageError> {
    validate_project_identity(connection, manifest)?;
    let mut table_statement = connection
        .prepare("SELECT id, name, emoji, position FROM data_tables ORDER BY position ASC")?;
    let table_rows = table_statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, i64>(3)?,
        ))
    })?;
    let mut tables = Vec::new();
    for table_row in table_rows {
        let (id, name, emoji, position) = table_row?;
        let title_field_id: String = connection.query_row(
            "SELECT id FROM fields WHERE table_id = ?1 AND is_title = 1",
            [&id],
            |row| row.get(0),
        )?;
        let record_count: i64 = connection.query_row(
            "SELECT COUNT(*) FROM records WHERE table_id = ?1",
            [&id],
            |row| row.get(0),
        )?;
        let mut view_statement = connection.prepare(
            "SELECT id, name, view_type, position FROM views WHERE table_id = ?1 ORDER BY position ASC",
        )?;
        let view_rows = view_statement.query_map([&id], |row| {
            Ok(ViewSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                view_type: row.get(2)?,
                position: row.get(3)?,
            })
        })?;
        let views = view_rows.collect::<Result<Vec<_>, _>>()?;
        tables.push(TableSummary {
            id,
            name,
            emoji,
            position,
            title_field_id,
            record_count,
            views,
        });
    }
    Ok(ProjectSnapshot {
        manifest: manifest.clone(),
        tables,
    })
}

pub fn create_table(connection: &mut Connection, name: &str) -> Result<TableSummary, StorageError> {
    create_table_internal(connection, name, false)
}

#[cfg(test)]
pub fn create_table_for_test(
    connection: &mut Connection,
    name: &str,
    fail_after_table_insert: bool,
) -> Result<TableSummary, StorageError> {
    create_table_internal(connection, name, fail_after_table_insert)
}

fn create_table_internal(
    connection: &mut Connection,
    name: &str,
    fail_after_table_insert: bool,
) -> Result<TableSummary, StorageError> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 200 {
        return Err(StorageError::validation(
            "表名称不能为空且不能超过 200 个字符",
        ));
    }
    let transaction = connection.transaction()?;
    let position: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM data_tables WHERE project_id = 'project'",
        [],
        |row| row.get(0),
    )?;
    let table_id = new_id("table");
    insert_table_row(&transaction, &table_id, name, position)?;
    if fail_after_table_insert {
        return Err(StorageError::new(
            StorageErrorCode::DatabaseError,
            "测试事务失败",
            false,
        ));
    }
    insert_table_defaults(&transaction, &table_id)?;
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    transaction.commit()?;
    let manifest_name: String = connection.query_row(
        "SELECT name FROM project_meta WHERE id = 'project'",
        [],
        |row| row.get(0),
    )?;
    let project_id: String = connection.query_row(
        "SELECT project_id FROM project_meta WHERE id = 'project'",
        [],
        |row| row.get(0),
    )?;
    let manifest = ProjectManifest {
        id: project_id,
        name: manifest_name,
        format_version: 1,
        created_at: String::new(),
        updated_at: String::new(),
    };
    load_snapshot(connection, &manifest)?
        .tables
        .into_iter()
        .find(|table| table.id == table_id)
        .ok_or_else(|| {
            StorageError::new(
                StorageErrorCode::DatabaseError,
                "新建表后无法读取表信息",
                false,
            )
        })
}

fn insert_table_row(
    transaction: &rusqlite::Transaction<'_>,
    table_id: &str,
    name: &str,
    position: i64,
) -> Result<(), StorageError> {
    let now = timestamp();
    transaction.execute(
        "INSERT INTO data_tables (id, project_id, name, position, created_at, updated_at)
         VALUES (?1, 'project', ?2, ?3, ?4, ?4)",
        (table_id, name, position, &now),
    )?;
    Ok(())
}

fn insert_table_defaults(
    transaction: &rusqlite::Transaction<'_>,
    table_id: &str,
) -> Result<(), StorageError> {
    let now = timestamp();
    let field_id = new_id("field");
    transaction.execute(
        "INSERT INTO fields (id, table_id, name, field_type, is_title, position, config_json, created_at, updated_at)
         VALUES (?1, ?2, '标题', 'text', 1, 0, '{}', ?3, ?3)",
        (&field_id, table_id, &now),
    )?;
    let view_id = new_id("view");
    transaction.execute(
        "INSERT INTO views (id, table_id, name, view_type, position, created_at, updated_at)
         VALUES (?1, ?2, '表格', 'table', 0, ?3, ?3)",
        (&view_id, table_id, &now),
    )?;
    transaction.execute(
        "INSERT INTO view_configs (view_id, version, config_json, created_at, updated_at)
         VALUES (?1, 1, '{}', ?2, ?2)",
        (&view_id, &now),
    )?;
    transaction.execute("INSERT INTO table_configs (table_id, detail_field_ids_json, updated_at) VALUES (?1, '[]', ?2)", (table_id, &now))?;
    Ok(())
}

pub(crate) fn new_id(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let sequence = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{nanos}-{sequence}")
}

#[cfg(test)]
#[path = "repository_tests.rs"]
mod tests;

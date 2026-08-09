use rusqlite::{Connection, OptionalExtension, Transaction};

use super::connection::timestamp;
use super::error::{StorageError, StorageErrorCode};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeletedTable {
    table: TableRow,
    fields: Vec<FieldRow>,
    views: Vec<ViewRow>,
    configs: Vec<ViewConfigRow>,
    records: Vec<RecordRow>,
    values: Vec<CellValueRow>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TableRow {
    id: String,
    project_id: String,
    name: String,
    position: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct FieldRow {
    id: String,
    table_id: String,
    name: String,
    field_type: String,
    is_title: i64,
    position: i64,
    config_json: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ViewRow {
    id: String,
    table_id: String,
    name: String,
    view_type: String,
    position: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ViewConfigRow {
    view_id: String,
    version: i64,
    config_json: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RecordRow {
    id: String,
    table_id: String,
    position: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CellValueRow {
    record_id: String,
    field_id: String,
    value_json: String,
    updated_at: String,
}

pub fn delete_table(
    connection: &mut Connection,
    table_id: &str,
) -> Result<DeletedTable, StorageError> {
    let transaction = connection.transaction()?;
    let count: i64 =
        transaction.query_row("SELECT COUNT(*) FROM data_tables", [], |row| row.get(0))?;
    if count <= 1 {
        return Err(StorageError::validation("项目至少需要保留一张表"));
    }
    let backup = capture(&transaction, table_id)?;
    let deleted = transaction.execute("DELETE FROM data_tables WHERE id = ?1", [table_id])?;
    if deleted != 1 {
        return Err(StorageError::new(
            StorageErrorCode::ValidationError,
            "要删除的表不存在",
            false,
        ));
    }
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    transaction.commit()?;
    Ok(backup)
}

pub fn restore_table(
    connection: &mut Connection,
    backup: &DeletedTable,
) -> Result<(), StorageError> {
    let transaction = connection.transaction()?;
    let exists: Option<String> = transaction
        .query_row(
            "SELECT id FROM data_tables WHERE id = ?1",
            [&backup.table.id],
            |row| row.get(0),
        )
        .optional()?;
    if exists.is_some() {
        return Err(StorageError::validation("要恢复的表已存在"));
    }
    let position: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM data_tables WHERE project_id = ?1",
        [&backup.table.project_id],
        |row| row.get(0),
    )?;
    transaction.execute(
        "INSERT INTO data_tables (id, project_id, name, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (&backup.table.id, &backup.table.project_id, &backup.table.name, position, &backup.table.created_at, &backup.table.updated_at),
    )?;
    for field in &backup.fields {
        transaction.execute(
            "INSERT INTO fields (id, table_id, name, field_type, is_title, position, config_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            (&field.id, &field.table_id, &field.name, &field.field_type, field.is_title, field.position, &field.config_json, &field.created_at, &field.updated_at),
        )?;
    }
    for view in &backup.views {
        transaction.execute(
            "INSERT INTO views (id, table_id, name, view_type, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (&view.id, &view.table_id, &view.name, &view.view_type, view.position, &view.created_at, &view.updated_at),
        )?;
    }
    for config in &backup.configs {
        transaction.execute(
            "INSERT INTO view_configs (view_id, version, config_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            (&config.view_id, config.version, &config.config_json, &config.created_at, &config.updated_at),
        )?;
    }
    for record in &backup.records {
        transaction.execute(
            "INSERT INTO records (id, table_id, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            (&record.id, &record.table_id, record.position, &record.created_at, &record.updated_at),
        )?;
    }
    for value in &backup.values {
        transaction.execute(
            "INSERT INTO cell_values (record_id, field_id, value_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            (&value.record_id, &value.field_id, &value.value_json, &value.updated_at),
        )?;
    }
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    transaction.commit()?;
    Ok(())
}

fn capture(transaction: &Transaction<'_>, table_id: &str) -> Result<DeletedTable, StorageError> {
    let table = transaction.query_row(
        "SELECT id, project_id, name, position, created_at, updated_at FROM data_tables WHERE id = ?1",
        [table_id],
        |row| Ok(TableRow { id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?, position: row.get(3)?, created_at: row.get(4)?, updated_at: row.get(5)? }),
    ).optional()?.ok_or_else(|| StorageError::new(StorageErrorCode::ValidationError, "要删除的表不存在", false))?;
    let mut fields = Vec::new();
    let mut statement = transaction.prepare("SELECT id, table_id, name, field_type, is_title, position, config_json, created_at, updated_at FROM fields WHERE table_id = ?1 ORDER BY position")?;
    for row in statement.query_map([table_id], |row| {
        Ok(FieldRow {
            id: row.get(0)?,
            table_id: row.get(1)?,
            name: row.get(2)?,
            field_type: row.get(3)?,
            is_title: row.get(4)?,
            position: row.get(5)?,
            config_json: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })? {
        fields.push(row?);
    }
    let mut views = Vec::new();
    let mut statement = transaction.prepare("SELECT id, table_id, name, view_type, position, created_at, updated_at FROM views WHERE table_id = ?1 ORDER BY position")?;
    for row in statement.query_map([table_id], |row| {
        Ok(ViewRow {
            id: row.get(0)?,
            table_id: row.get(1)?,
            name: row.get(2)?,
            view_type: row.get(3)?,
            position: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })? {
        views.push(row?);
    }
    let mut configs = Vec::new();
    let mut statement = transaction.prepare("SELECT c.view_id, c.version, c.config_json, c.created_at, c.updated_at FROM view_configs c JOIN views v ON v.id = c.view_id WHERE v.table_id = ?1")?;
    for row in statement.query_map([table_id], |row| {
        Ok(ViewConfigRow {
            view_id: row.get(0)?,
            version: row.get(1)?,
            config_json: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })? {
        configs.push(row?);
    }
    let mut records = Vec::new();
    let mut statement = transaction.prepare("SELECT id, table_id, position, created_at, updated_at FROM records WHERE table_id = ?1 ORDER BY position")?;
    for row in statement.query_map([table_id], |row| {
        Ok(RecordRow {
            id: row.get(0)?,
            table_id: row.get(1)?,
            position: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })? {
        records.push(row?);
    }
    let mut values = Vec::new();
    let mut statement = transaction.prepare("SELECT c.record_id, c.field_id, c.value_json, c.updated_at FROM cell_values c JOIN records r ON r.id = c.record_id WHERE r.table_id = ?1")?;
    for row in statement.query_map([table_id], |row| {
        Ok(CellValueRow {
            record_id: row.get(0)?,
            field_id: row.get(1)?,
            value_json: row.get(2)?,
            updated_at: row.get(3)?,
        })
    })? {
        values.push(row?);
    }
    Ok(DeletedTable {
        table,
        fields,
        views,
        configs,
        records,
        values,
    })
}

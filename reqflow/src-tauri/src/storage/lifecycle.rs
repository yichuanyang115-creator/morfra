use std::collections::HashSet;

use rusqlite::{params, Connection, OptionalExtension};

use super::connection::timestamp;
use super::error::{StorageError, StorageErrorCode};
use super::repository::new_id;

pub fn validate_name(name: &str, subject: &str) -> Result<String, StorageError> {
    let normalized = name.trim();
    if normalized.is_empty() || normalized.chars().count() > 200 {
        return Err(StorageError::validation(&format!(
            "{subject}名称不能为空且不能超过 200 个字符"
        )));
    }
    Ok(normalized.to_string())
}

pub fn rename_project(connection: &mut Connection, name: &str) -> Result<(), StorageError> {
    let name = validate_name(name, "项目")?;
    let transaction = connection.transaction()?;
    let changed = transaction.execute(
        "UPDATE project_meta SET name = ?1, updated_at = ?2 WHERE id = 'project'",
        (&name, timestamp()),
    )?;
    if changed != 1 {
        return Err(StorageError::new(
            StorageErrorCode::ProjectNotFound,
            "当前项目不存在",
            false,
        ));
    }
    transaction.commit()?;
    Ok(())
}

pub fn rename_table(
    connection: &mut Connection,
    table_id: &str,
    name: &str,
) -> Result<(), StorageError> {
    let name = validate_name(name, "表")?;
    let transaction = connection.transaction()?;
    let changed = transaction.execute(
        "UPDATE data_tables SET name = ?1, updated_at = ?2 WHERE id = ?3",
        (&name, timestamp(), table_id),
    )?;
    if changed != 1 {
        return Err(StorageError::new(
            StorageErrorCode::ValidationError,
            "要重命名的表不存在",
            false,
        ));
    }
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn reorder_tables(connection: &mut Connection, ids: &[String]) -> Result<(), StorageError> {
    reorder(
        connection,
        "data_tables",
        "project_id = 'project'",
        None,
        ids,
        "表",
    )
}

pub fn create_view(
    connection: &mut Connection,
    table_id: &str,
    name: &str,
    view_type: &str,
) -> Result<(), StorageError> {
    let name = validate_name(name, "视图")?;
    if view_type != "table" && view_type != "board" {
        return Err(StorageError::validation("视图类型无效"));
    }
    let transaction = connection.transaction()?;
    ensure_table(&transaction, table_id)?;
    ensure_unique_name(&transaction, "views", "table_id", table_id, &name, "视图")?;
    let position: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM views WHERE table_id = ?1",
        [table_id],
        |row| row.get(0),
    )?;
    let id = new_id("view");
    let now = timestamp();
    transaction.execute("INSERT INTO views (id, table_id, name, view_type, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)", (&id, table_id, &name, view_type, position, &now))?;
    transaction.execute("INSERT INTO view_configs (view_id, version, config_json, created_at, updated_at) VALUES (?1, 1, '{}', ?2, ?2)", (&id, &now))?;
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [now],
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn rename_view(
    connection: &mut Connection,
    view_id: &str,
    name: &str,
) -> Result<(), StorageError> {
    let name = validate_name(name, "视图")?;
    let transaction = connection.transaction()?;
    let changed = transaction.execute(
        "UPDATE views SET name = ?1, updated_at = ?2 WHERE id = ?3",
        (&name, timestamp(), view_id),
    )?;
    if changed != 1 {
        return Err(StorageError::new(
            StorageErrorCode::ValidationError,
            "要重命名的视图不存在",
            false,
        ));
    }
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn duplicate_view(
    connection: &mut Connection,
    view_id: &str,
    name: &str,
) -> Result<(), StorageError> {
    let name = validate_name(name, "视图")?;
    let transaction = connection.transaction()?;
    let source: Option<(String, String, String)> = transaction.query_row("SELECT v.table_id, v.view_type, c.config_json FROM views v JOIN view_configs c ON c.view_id = v.id WHERE v.id = ?1", [view_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))).optional()?;
    let Some((table_id, view_type, config_json)) = source else {
        return Err(StorageError::new(
            StorageErrorCode::ValidationError,
            "要复制的视图不存在",
            false,
        ));
    };
    ensure_unique_name(&transaction, "views", "table_id", &table_id, &name, "视图")?;
    let position: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM views WHERE table_id = ?1",
        [&table_id],
        |row| row.get(0),
    )?;
    let id = new_id("view");
    let now = timestamp();
    transaction.execute("INSERT INTO views (id, table_id, name, view_type, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)", (&id, &table_id, &name, &view_type, position, &now))?;
    transaction.execute("INSERT INTO view_configs (view_id, version, config_json, created_at, updated_at) VALUES (?1, 1, ?2, ?3, ?3)", (&id, &config_json, &now))?;
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [now],
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn delete_view(connection: &mut Connection, view_id: &str) -> Result<(), StorageError> {
    let transaction = connection.transaction()?;
    let table_id: String = transaction
        .query_row(
            "SELECT table_id FROM views WHERE id = ?1",
            [view_id],
            |row| row.get(0),
        )
        .optional()?
        .ok_or_else(|| {
            StorageError::new(
                StorageErrorCode::ValidationError,
                "要删除的视图不存在",
                false,
            )
        })?;
    let count: i64 = transaction.query_row(
        "SELECT COUNT(*) FROM views WHERE table_id = ?1",
        [&table_id],
        |row| row.get(0),
    )?;
    if count <= 1 {
        return Err(StorageError::validation("每张表至少需要保留一个视图"));
    }
    transaction.execute("DELETE FROM views WHERE id = ?1", [view_id])?;
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn reorder_views(
    connection: &mut Connection,
    table_id: &str,
    ids: &[String],
) -> Result<(), StorageError> {
    reorder(
        connection,
        "views",
        "table_id = ?1",
        Some(table_id),
        ids,
        "视图",
    )
}

fn reorder(
    connection: &mut Connection,
    table: &str,
    scope: &str,
    scope_value: Option<&str>,
    ids: &[String],
    subject: &str,
) -> Result<(), StorageError> {
    let sql = format!("SELECT id FROM {table} WHERE {scope} ORDER BY position");
    let actual = if let Some(scope_value) = scope_value {
        connection
            .prepare(&sql)?
            .query_map([scope_value], |row| row.get::<_, String>(0))?
            .collect::<Result<HashSet<_>, _>>()?
    } else {
        connection
            .prepare(&sql)?
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<HashSet<_>, _>>()?
    };
    if actual.len() != ids.len() || ids.iter().cloned().collect::<HashSet<_>>() != actual {
        return Err(StorageError::validation(&format!(
            "{subject}排序列表与当前数据不一致"
        )));
    }
    let transaction = connection.transaction()?;
    let offset = i64::try_from(actual.len()).unwrap_or(0) + 1;
    let update_scope = format!(
        "UPDATE {table} SET position = position + ?1 WHERE {}",
        scope.replace("?1", "?2")
    );
    if let Some(scope_value) = scope_value {
        transaction.execute(&update_scope, params![offset, scope_value])?;
    } else {
        transaction.execute(&update_scope, [offset])?;
    }
    for (position, id) in ids.iter().enumerate() {
        transaction.execute(
            &format!("UPDATE {table} SET position = ?1, updated_at = ?2 WHERE id = ?3"),
            (i64::try_from(position).unwrap_or(0), timestamp(), id),
        )?;
    }
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    transaction.commit()?;
    Ok(())
}

fn ensure_table(
    transaction: &rusqlite::Transaction<'_>,
    table_id: &str,
) -> Result<(), StorageError> {
    let found: Option<String> = transaction
        .query_row(
            "SELECT id FROM data_tables WHERE id = ?1",
            [table_id],
            |row| row.get(0),
        )
        .optional()?;
    found
        .ok_or_else(|| StorageError::new(StorageErrorCode::ValidationError, "目标表不存在", false))
        .map(|_| ())
}

fn ensure_unique_name(
    transaction: &rusqlite::Transaction<'_>,
    table: &str,
    scope_column: &str,
    scope: &str,
    name: &str,
    subject: &str,
) -> Result<(), StorageError> {
    let sql = format!("SELECT 1 FROM {table} WHERE {scope_column} = ?1 AND name = ?2");
    if transaction
        .query_row(&sql, (scope, name), |_| Ok(()))
        .optional()?
        .is_some()
    {
        return Err(StorageError::validation(&format!("{subject}名称已存在")));
    }
    Ok(())
}

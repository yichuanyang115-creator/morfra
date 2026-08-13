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

fn update_table_emoji_internal(
    connection: &mut Connection,
    table_id: &str,
    emoji: &str,
    fail_before_commit: bool,
) -> Result<(), StorageError> {
    let emoji = emoji.trim();
    if emoji.is_empty() || emoji.chars().count() > 16 {
        return Err(StorageError::validation("表 Emoji 不能为空且不能超过 16 个字符"));
    }
    let transaction = connection.transaction()?;
    let changed = transaction.execute(
        "UPDATE data_tables SET emoji = ?1, updated_at = ?2 WHERE id = ?3",
        (emoji, timestamp(), table_id),
    )?;
    if changed != 1 {
        return Err(StorageError::new(
            StorageErrorCode::ValidationError,
            "要更新 Emoji 的表不存在",
            false,
        ));
    }
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    if fail_before_commit {
        return Err(StorageError::new(
            StorageErrorCode::DatabaseError,
            "测试事务失败",
            false,
        ));
    }
    transaction.commit()?;
    Ok(())
}

pub fn update_table_emoji(
    connection: &mut Connection,
    table_id: &str,
    emoji: &str,
) -> Result<(), StorageError> {
    update_table_emoji_internal(connection, table_id, emoji, false)
}

#[cfg(test)]
pub fn update_table_emoji_for_test(
    connection: &mut Connection,
    table_id: &str,
    emoji: &str,
    fail_before_commit: bool,
) -> Result<(), StorageError> {
    update_table_emoji_internal(connection, table_id, emoji, fail_before_commit)
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

pub fn reorder_field_groups(
    connection: &mut Connection,
    table_id: &str,
    ids: &[String],
) -> Result<(), StorageError> {
    reorder(
        connection,
        "field_groups",
        "table_id = ?1",
        Some(table_id),
        ids,
        "字段组",
    )
}

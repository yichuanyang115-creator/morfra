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

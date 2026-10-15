pub fn load_view_config(connection: &Connection, view_id: &str) -> Result<Value, StorageError> {
    let json: String = connection
        .query_row(
            "SELECT config_json FROM view_configs WHERE view_id = ?1",
            [view_id],
            |row| row.get(0),
        )
        .optional()?
        .ok_or_else(|| StorageError::validation("视图不存在"))?;
    serde_json::from_str(&json).map_err(StorageError::from)
}

pub fn update_view_config(
    connection: &mut Connection,
    view_id: &str,
    config: Value,
) -> Result<Value, StorageError> {
    if !config.is_object() {
        return Err(StorageError::validation("视图配置必须是对象"));
    }
    let transaction = connection.transaction()?;
    let table_id: String = transaction
        .query_row(
            "SELECT table_id FROM views WHERE id = ?1",
            [view_id],
            |row| row.get(0),
        )
        .optional()?
        .ok_or_else(|| StorageError::validation("视图不存在"))?;
    let current_json: String = transaction.query_row(
        "SELECT config_json FROM view_configs WHERE view_id = ?1",
        [view_id],
        |row| row.get(0),
    )?;
    let mut merged = serde_json::from_str::<Value>(&current_json).map_err(StorageError::from)?;
    if let (Some(current), Some(next)) = (merged.as_object_mut(), config.as_object()) {
        for (key, value) in next {
            current.insert(key.clone(), value.clone());
        }
    }
    if let Some(field_ids) = merged.get("fieldIds").and_then(Value::as_array) {
        let valid: std::collections::HashSet<String> = transaction
            .prepare("SELECT id FROM fields WHERE table_id = ?1")?
            .query_map([&table_id], |row| row.get(0))?
            .collect::<Result<_, _>>()?;
        let requested: std::collections::HashSet<String> = field_ids
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect();
        let title_id: String = transaction.query_row(
            "SELECT id FROM fields WHERE table_id = ?1 AND is_title = 1",
            [&table_id],
            |row| row.get(0),
        )?;
        if requested.len() != field_ids.len()
            || !requested.is_subset(&valid)
            || field_ids.first().and_then(Value::as_str) != Some(title_id.as_str())
        {
            return Err(StorageError::validation(
                "视图字段显示列表与当前表字段不一致",
            ));
        }
    }
    let json = serde_json::to_string(&merged).map_err(StorageError::from)?;
    transaction.execute(
        "UPDATE view_configs SET config_json = ?1, updated_at = ?2 WHERE view_id = ?3",
        params![json, timestamp(), view_id],
    )?;
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    transaction.commit()?;
    Ok(merged)
}

pub fn load_detail_fields(
    connection: &Connection,
    table_id: &str,
) -> Result<Vec<String>, StorageError> {
    let json: String = connection
        .query_row(
            "SELECT detail_field_ids_json FROM table_configs WHERE table_id = ?1",
            [table_id],
            |row| row.get(0),
        )
        .optional()?
        .ok_or_else(|| StorageError::validation("表不存在"))?;
    serde_json::from_str(&json).map_err(StorageError::from)
}

pub fn update_detail_fields(
    connection: &mut Connection,
    table_id: &str,
    field_ids: &[String],
) -> Result<Vec<String>, StorageError> {
    let transaction = connection.transaction()?;
    let valid: HashSet<String> = transaction
        .prepare("SELECT id FROM fields WHERE table_id = ?1 AND is_title = 0")?
        .query_map([table_id], |row| row.get(0))?
        .collect::<Result<_, _>>()?;
    let requested: HashSet<String> = field_ids.iter().cloned().collect();
    if requested.len() != field_ids.len() || !requested.is_subset(&valid) {
        return Err(StorageError::validation("详情字段列表与当前表字段不一致"));
    }
    let json = serde_json::to_string(field_ids).map_err(StorageError::from)?;
    if transaction.execute(
        "UPDATE table_configs SET detail_field_ids_json = ?1, updated_at = ?2 WHERE table_id = ?3",
        params![json, timestamp(), table_id],
    )? != 1
    {
        return Err(StorageError::validation("表不存在"));
    }
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    transaction.commit()?;
    Ok(field_ids.to_vec())
}



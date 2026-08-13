fn table_id_for_field(
    transaction: &Transaction<'_>,
    field_id: &str,
) -> Result<String, StorageError> {
    transaction
        .query_row(
            "SELECT table_id FROM fields WHERE id = ?1",
            [field_id],
            |row| row.get(0),
        )
        .map_err(StorageError::from)
}
fn table_id_for_field_read(
    connection: &Connection,
    field_id: &str,
) -> Result<String, StorageError> {
    connection
        .query_row(
            "SELECT table_id FROM fields WHERE id = ?1",
            [field_id],
            |row| row.get(0),
        )
        .map_err(StorageError::from)
}
fn ensure_table(connection: &Connection, table_id: &str) -> Result<(), StorageError> {
    connection
        .query_row(
            "SELECT 1 FROM data_tables WHERE id = ?1",
            [table_id],
            |_| Ok(()),
        )
        .optional()?
        .ok_or_else(|| StorageError::validation("目标表不存在"))
        .map(|_| ())
}
fn ensure_table_tx(transaction: &Transaction<'_>, table_id: &str) -> Result<(), StorageError> {
    transaction
        .query_row(
            "SELECT 1 FROM data_tables WHERE id = ?1",
            [table_id],
            |_| Ok(()),
        )
        .optional()?
        .ok_or_else(|| StorageError::validation("目标表不存在"))
        .map(|_| ())
}
fn validate_field_type(field_type: &str) -> Result<(), StorageError> {
    if super::domain::is_supported_field_type(field_type) {
        Ok(())
    } else {
        Err(StorageError::validation("不支持的字段类型"))
    }
}
fn validate_name(name: &str, subject: &str) -> Result<String, StorageError> {
    let normalized = name.trim();
    if normalized.is_empty() || normalized.chars().count() > 200 {
        return Err(StorageError::validation(&format!(
            "{subject}名称不能为空且不能超过 200 个字符"
        )));
    }
    Ok(normalized.to_string())
}
fn normalize_config(config: Value) -> Result<String, StorageError> {
    let value = if config.is_null() { json!({}) } else { config };
    if !value.is_object() {
        return Err(StorageError::validation("字段配置必须是对象"));
    }
    serde_json::to_string(&value).map_err(StorageError::from)
}
fn normalize_field_config(field_type: &str, config: Value) -> Result<String, StorageError> {
    let mut value = if config.is_null() { json!({}) } else { config };
    if !value.is_object() {
        return Err(StorageError::validation("字段配置必须是对象"));
    }
    let object = value.as_object_mut().expect("object checked");
    match field_type {
        "text" => {
            if !object
                .get("multiline")
                .map(Value::is_boolean)
                .unwrap_or(false)
            {
                object.insert("multiline".into(), Value::Bool(false));
            }
        }
        "number" => {
            if !matches!(
                object.get("format").and_then(Value::as_str),
                Some("number" | "percent" | "currency")
            ) {
                object.insert("format".into(), Value::String("number".into()));
            }
        }
        "date" => {
            if !object
                .get("includeTime")
                .map(Value::is_boolean)
                .unwrap_or(false)
            {
                object.insert("includeTime".into(), Value::Bool(false));
            }
        }
        "select" | "multi_select"
            if !object
                .get("allowCreate")
                .map(Value::is_boolean)
                .unwrap_or(false) =>
        {
            object.insert("allowCreate".into(), Value::Bool(true));
        }
        _ => {}
    }
    normalize_config(value)
}
fn ensure_unique_name(
    transaction: &Transaction<'_>,
    table: &str,
    scope_column: &str,
    scope: &str,
    name: &str,
    subject: &str,
) -> Result<(), StorageError> {
    let sql = format!("SELECT 1 FROM {table} WHERE {scope_column} = ?1 AND name = ?2");
    if transaction
        .query_row(&sql, params![scope, name], |_| Ok(()))
        .optional()?
        .is_some()
    {
        return Err(StorageError::validation(&format!("{subject}名称已存在")));
    }
    Ok(())
}
fn ensure_unique_name_excluding(
    transaction: &Transaction<'_>,
    table: &str,
    scope_column: &str,
    scope: &str,
    name: &str,
    subject: &str,
    excluded_id: &str,
) -> Result<(), StorageError> {
    let sql = format!("SELECT 1 FROM {table} WHERE {scope_column} = ?1 AND name = ?2 AND id != ?3");
    if transaction
        .query_row(&sql, params![scope, name, excluded_id], |_| Ok(()))
        .optional()?
        .is_some()
    {
        return Err(StorageError::validation(&format!("{subject}名称已存在")));
    }
    Ok(())
}
fn touch_project(transaction: &Transaction<'_>) -> Result<(), StorageError> {
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    Ok(())
}

fn option_belongs_to_field(
    connection: &Connection,
    option_id: &str,
    field_id: &str,
) -> Result<bool, StorageError> {
    Ok(connection
        .query_row(
            "SELECT 1 FROM field_options WHERE id = ?1 AND field_id = ?2",
            params![option_id, field_id],
            |_| Ok(()),
        )
        .optional()?
        .is_some())
}

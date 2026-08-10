fn load_field(transaction: &Transaction<'_>, field_id: &str) -> Result<FieldRow, StorageError> {
    transaction.query_row("SELECT id, table_id, group_id, name, field_type, is_title, position, config_json, created_at, updated_at FROM fields WHERE id = ?1", [field_id], |row| Ok(FieldRow { id: row.get(0)?, table_id: row.get(1)?, group_id: row.get(2)?, name: row.get(3)?, field_type: row.get(4)?, is_title: row.get(5)?, position: row.get(6)?, config_json: row.get(7)?, created_at: row.get(8)?, updated_at: row.get(9)? })).optional()?.ok_or_else(|| StorageError::validation("字段不存在"))
}
fn field_row_from_summary(field: &FieldSummary) -> Result<FieldRow, StorageError> {
    Ok(FieldRow {
        id: field.id.clone(),
        table_id: field.table_id.clone(),
        group_id: field.group_id.clone(),
        name: field.name.clone(),
        field_type: field.field_type.clone(),
        is_title: i64::from(field.is_title),
        position: field.position,
        config_json: serde_json::to_string(&field.config).map_err(StorageError::from)?,
        created_at: String::new(),
        updated_at: String::new(),
    })
}
fn ensure_record_table(transaction: &Transaction<'_>, table_id: &str) -> Result<(), StorageError> {
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
fn write_value(
    transaction: &Transaction<'_>,
    record_id: &str,
    field: &FieldRow,
    value: &Value,
) -> Result<(), StorageError> {
    if field.is_title == 1
        && (!value.is_string() || value.as_str().unwrap_or_default().trim().is_empty())
    {
        return Err(StorageError::validation("主标题不能为空"));
    }
    if ["auto_number", "created_time", "updated_time"].contains(&field.field_type.as_str()) {
        return Err(StorageError::validation("自动编号和系统时间字段不可编辑"));
    }
    let normalized = normalize_value(transaction, field, value)?;
    transaction.execute(
        "DELETE FROM cell_values WHERE record_id = ?1 AND field_id = ?2",
        params![record_id, field.id],
    )?;
    transaction.execute(
        "DELETE FROM multi_select_values WHERE record_id = ?1 AND field_id = ?2",
        params![record_id, field.id],
    )?;
    match field.field_type.as_str() {
        "multi_select" => {
            for (position, option_id) in normalized
                .as_array()
                .unwrap_or(&Vec::new())
                .iter()
                .filter_map(Value::as_str)
                .enumerate()
            {
                transaction.execute("INSERT INTO multi_select_values (record_id, field_id, option_id, position) VALUES (?1, ?2, ?3, ?4)", params![record_id, field.id, option_id, position as i64])?;
            }
        }
        _ if !normalized.is_null() => {
            transaction.execute("INSERT INTO cell_values (record_id, field_id, value_json, updated_at) VALUES (?1, ?2, json(?3), ?4)", params![record_id, field.id, normalized.to_string(), timestamp()])?;
        }
        _ => {}
    }
    Ok(())
}
fn normalize_value(
    transaction: &Transaction<'_>,
    field: &FieldRow,
    value: &Value,
) -> Result<Value, StorageError> {
    if value.is_null() {
        return Ok(Value::Null);
    }
    match field.field_type.as_str() {
        "text" | "image" | "file" | "link" | "date" => value
            .as_str()
            .map(|text| Value::String(text.to_string()))
            .ok_or_else(|| StorageError::validation("该字段需要文本值")),
        "number" => value
            .as_f64()
            .filter(|number| number.is_finite())
            .map(|number| json!(number))
            .ok_or_else(|| StorageError::validation("数字字段需要有效数字")),
        "progress" => value
            .as_f64()
            .filter(|number| (0.0..=100.0).contains(number))
            .map(|number| json!(number))
            .ok_or_else(|| StorageError::validation("进度必须在 0 到 100 之间")),
        "checkbox" => value
            .as_bool()
            .map(Value::Bool)
            .ok_or_else(|| StorageError::validation("复选框字段需要布尔值")),
        "select" => validate_option(transaction, field, value).map(Value::String),
        "multi_select" => {
            let Some(items) = value.as_array() else {
                return Err(StorageError::validation("多选字段需要选项数组"));
            };
            let mut result = Vec::new();
            for item in items {
                let id = validate_option(transaction, field, item)?;
                if !result.contains(&id) {
                    result.push(id);
                }
            }
            Ok(Value::Array(
                result.into_iter().map(Value::String).collect(),
            ))
        }
        _ => Err(StorageError::validation("该字段类型不可写入")),
    }
}

fn validate_option(
    transaction: &Transaction<'_>,
    field: &FieldRow,
    value: &Value,
) -> Result<String, StorageError> {
    let option_value = value
        .as_str()
        .ok_or_else(|| StorageError::validation("选项值无效"))?
        .trim();
    let found: Option<String> = transaction
        .query_row(
            "SELECT id FROM field_options WHERE id = ?1 AND field_id = ?2",
            params![option_value, field.id],
            |row| row.get(0),
        )
        .optional()?;
    if let Some(id) = found {
        return Ok(id);
    }
    let config: Value = serde_json::from_str(&field.config_json).map_err(StorageError::from)?;
    if config.get("allowCreate").and_then(Value::as_bool) != Some(true) {
        return Err(StorageError::validation("选项不属于当前字段"));
    }
    let now = timestamp();
    let option_id = new_id("option");
    let position: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM field_options WHERE field_id = ?1",
        [&field.id],
        |row| row.get(0),
    )?;
    transaction.execute("INSERT INTO field_options (id, field_id, name, color, position, created_at, updated_at) VALUES (?1, ?2, ?3, 'blue', ?4, ?5, ?5)", params![option_id, field.id, option_value, position, now])?;
    Ok(option_id)
}
fn touch_project(transaction: &Transaction<'_>) -> Result<(), StorageError> {
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    Ok(())
}

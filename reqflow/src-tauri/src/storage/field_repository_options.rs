pub fn create_option(
    connection: &mut Connection,
    field_id: &str,
    name: &str,
    color: Option<&str>,
) -> Result<String, StorageError> {
    let name = validate_name(name, "选项")?;
    let transaction = connection.transaction()?;
    let field = load_field_row_tx(&transaction, field_id)?;
    if field.field_type != "select" && field.field_type != "multi_select" {
        return Err(StorageError::validation("只有单选和多选字段支持选项"));
    }
    ensure_unique_name(
        &transaction,
        "field_options",
        "field_id",
        field_id,
        &name,
        "选项",
    )?;
    let position: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM field_options WHERE field_id = ?1",
        [field_id],
        |row| row.get(0),
    )?;
    let color = color
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(DEFAULT_OPTION_COLORS[(position as usize) % DEFAULT_OPTION_COLORS.len()]);
    let now = timestamp();
    let option = FieldOptionRow {
        id: new_id("option"),
        field_id: field_id.to_string(),
        name,
        color: color.to_string(),
        position,
        created_at: now.clone(),
        updated_at: now,
    };
    insert_option(&transaction, &option)?;
    touch_project(&transaction)?;
    let option_id = option.id.clone();
    transaction.commit()?;
    Ok(option_id)
}

pub fn update_option(
    connection: &mut Connection,
    option_id: &str,
    name: &str,
    color: &str,
) -> Result<OptionBackup, StorageError> {
    let backup = capture_option(connection, option_id)?;
    let name = validate_name(name, "选项")?;
    let transaction = connection.transaction()?;
    ensure_unique_name_excluding(
        &transaction,
        "field_options",
        "field_id",
        &backup.option.field_id,
        &name,
        "选项",
        option_id,
    )?;
    transaction.execute(
        "UPDATE field_options SET name = ?1, color = ?2, updated_at = ?3 WHERE id = ?4",
        params![name, color, timestamp(), option_id],
    )?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(backup)
}

pub fn option_usage(connection: &Connection, option_id: &str) -> Result<OptionUsage, StorageError> {
    let field_id: String = connection
        .query_row(
            "SELECT field_id FROM field_options WHERE id = ?1",
            [option_id],
            |row| row.get(0),
        )
        .optional()?
        .ok_or_else(|| StorageError::validation("选项不存在"))?;
    let single_record_count: i64 = connection.query_row("SELECT COUNT(DISTINCT record_id) FROM cell_values WHERE field_id = ?1 AND json_extract(value_json, '$') = ?2", params![field_id, option_id], |row| row.get::<_, i64>(0))?;
    let multi_record_count: i64 = connection.query_row("SELECT COUNT(DISTINCT record_id) FROM multi_select_values WHERE field_id = ?1 AND option_id = ?2", params![field_id, option_id], |row| row.get::<_, i64>(0))?;
    let record_count = single_record_count + multi_record_count;
    let mut statement = connection.prepare("SELECT config_json FROM view_configs")?;
    let configs = statement.query_map([], |row| row.get::<_, String>(0))?.collect::<Result<Vec<_>, _>>()?;
    let view_rule_count = configs.iter().filter_map(|raw| serde_json::from_str::<Value>(raw).ok()).map(|config| count_option_rules(&config, &field_id, option_id)).sum();
    Ok(OptionUsage {
        record_count,
        view_rule_count,
    })
}

fn count_option_rules(value: &Value, field_id: &str, option_id: &str) -> i64 {
    match value {
        Value::Object(object) => {
            let this_rule = object.get("fieldId").and_then(Value::as_str) == Some(field_id) && object.values().any(|item| value_contains_string(item, option_id));
            if this_rule { 1 } else { object.values().map(|item| count_option_rules(item, field_id, option_id)).sum() }
        }
        Value::Array(items) => items.iter().map(|item| count_option_rules(item, field_id, option_id)).sum(),
        _ => 0,
    }
}

fn value_contains_string(value: &Value, expected: &str) -> bool { match value { Value::String(text) => text == expected, Value::Array(items) => items.iter().any(|item| value_contains_string(item, expected)), Value::Object(object) => object.values().any(|item| value_contains_string(item, expected)), _ => false } }

pub fn delete_option(
    connection: &mut Connection,
    option_id: &str,
    mode: &str,
    replacement_id: Option<&str>,
) -> Result<OptionBackup, StorageError> {
    let mut backup = capture_option(connection, option_id)?;
    let usage = option_usage(connection, option_id)?;
    if usage.record_count > 0 || usage.view_rule_count > 0 {
        match mode {
            "replace" => {
                let replacement =
                    replacement_id.ok_or_else(|| StorageError::validation("请选择替换选项"))?;
                if replacement == option_id
                    || !option_belongs_to_field(connection, replacement, &backup.option.field_id)?
                {
                    return Err(StorageError::validation(
                        "替换选项必须是同一字段内的其他选项",
                    ));
                }
            }
            "clear" => {}
            _ => return Err(StorageError::validation("已使用选项必须选择替换或清空")),
        }
    }
    let transaction = connection.transaction()?;
    let field = load_field_row_tx(&transaction, &backup.option.field_id)?;
    let affected_records = select_records_using_option(&transaction, &backup.option)?;
    rewrite_option_values(&transaction, &backup.option, mode, replacement_id)?;
    for record_id in affected_records {
        let next = if mode == "replace" { replacement_id.map(|id| Value::String(id.to_string())).unwrap_or(Value::Null) } else { Value::Null };
        if let Some(event_id) = activity_repository::track_select_change_with_id(&transaction, &record_id, &field, &Value::String(backup.option.id.clone()), &next)? {
            backup.activity_event_ids.push(event_id);
        }
    }
    clean_field_references(
        &transaction,
        &table_id_for_field(&transaction, &backup.option.field_id)?,
        &backup.option.field_id,
        Some((
            option_id,
            if mode == "replace" {
                replacement_id
            } else {
                None
            },
        )),
    )?;
    transaction.execute("DELETE FROM field_options WHERE id = ?1", [option_id])?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(backup)
}

fn select_records_using_option(transaction: &Transaction<'_>, option: &FieldOptionRow) -> Result<Vec<String>, StorageError> {
    if option.field_id.is_empty() { return Ok(Vec::new()); }
    transaction.prepare("SELECT record_id FROM cell_values WHERE field_id = ?1 AND json_extract(value_json, '$') = ?2")?.query_map(params![option.field_id, option.id], |row| row.get(0))?.collect::<Result<Vec<_>, _>>().map_err(StorageError::from)
}

pub fn restore_option(
    connection: &mut Connection,
    backup: &OptionBackup,
) -> Result<(), StorageError> {
    let transaction = connection.transaction()?;
    for event_id in &backup.activity_event_ids {
        transaction.execute("DELETE FROM activity_events WHERE id = ?1", [event_id])?;
    }
    transaction.execute(
        "DELETE FROM field_options WHERE id = ?1",
        [&backup.option.id],
    )?;
    insert_option(&transaction, &backup.option)?;
    transaction.execute(
        "DELETE FROM cell_values WHERE field_id = ?1",
        [&backup.option.field_id],
    )?;
    transaction.execute(
        "DELETE FROM multi_select_values WHERE field_id = ?1",
        [&backup.option.field_id],
    )?;
    for value in &backup.values {
        transaction.execute("INSERT INTO cell_values (record_id, field_id, value_json, updated_at) VALUES (?1, ?2, ?3, ?4)", params![value.record_id, value.field_id, value.value_json, value.updated_at])?;
    }
    for value in &backup.multi_values {
        transaction.execute("INSERT INTO multi_select_values (record_id, field_id, option_id, position) VALUES (?1, ?2, ?3, ?4)", params![value.record_id, value.field_id, value.option_id, value.position])?;
    }
    restore_view_configs(&transaction, &backup.view_configs)?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(())
}

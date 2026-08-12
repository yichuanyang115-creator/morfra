fn convert_field_values(
    transaction: &Transaction<'_>,
    field: &FieldRow,
    next_type: &str,
) -> Result<(), StorageError> {
    let option_names = load_option_names(transaction, &field.id)?;
    let mut cell_values = HashMap::new();
    let mut statement =
        transaction.prepare("SELECT record_id, value_json FROM cell_values WHERE field_id = ?1")?;
    for row in statement.query_map([&field.id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })? {
        let (record_id, value_json) = row?;
        cell_values.insert(
            record_id,
            serde_json::from_str::<Value>(&value_json).map_err(StorageError::from)?,
        );
    }
    let mut multi_values: HashMap<String, Vec<String>> = HashMap::new();
    let mut multi_statement = transaction.prepare("SELECT record_id, option_id FROM multi_select_values WHERE field_id = ?1 ORDER BY record_id, position")?;
    for row in multi_statement.query_map([&field.id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })? {
        let (record_id, option_id) = row?;
        multi_values.entry(record_id).or_default().push(option_id);
    }
    let mut record_ids = Vec::new();
    let mut records_statement = transaction.prepare("SELECT id FROM records WHERE table_id = (SELECT table_id FROM fields WHERE id = ?1) ORDER BY position")?;
    for row in records_statement.query_map([&field.id], |row| row.get::<_, String>(0))? {
        record_ids.push(row?);
    }
    drop(records_statement);
    let mut generated = HashMap::new();
    let mut generated_names = Vec::new();
    if next_type == "select" || next_type == "multi_select" {
        if field.field_type != "select" && field.field_type != "multi_select" {
            for record_id in &record_ids {
                if let Some(text) = old_value_text(
                    field,
                    cell_values.get(record_id),
                    multi_values.get(record_id),
                    &option_names,
                ) {
                    if !generated.contains_key(&text) {
                        generated.insert(text.clone(), new_id("option"));
                        generated_names.push(text);
                    }
                }
            }
            for (position, name) in generated_names.into_iter().enumerate() {
                let id = generated.get(&name).expect("generated option id");
                let now = timestamp();
                transaction.execute("INSERT INTO field_options (id, field_id, name, color, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)", params![id, field.id, name, DEFAULT_OPTION_COLORS[position % DEFAULT_OPTION_COLORS.len()], position as i64, now])?;
            }
        }
    } else {
        transaction.execute("DELETE FROM field_options WHERE field_id = ?1", [&field.id])?;
    }
    transaction.execute("DELETE FROM cell_values WHERE field_id = ?1", [&field.id])?;
    transaction.execute(
        "DELETE FROM multi_select_values WHERE field_id = ?1",
        [&field.id],
    )?;
    for record_id in record_ids {
        let old_text = old_value_text(
            field,
            cell_values.get(&record_id),
            multi_values.get(&record_id),
            &option_names,
        );
        let next_value = converted_value(
            field,
            next_type,
            old_text.as_deref(),
            multi_values.get(&record_id),
            &generated,
            &option_names,
        );
        write_converted_value(transaction, &record_id, &field.id, next_type, next_value)?;
    }
    Ok(())
}

fn load_option_names(
    transaction: &Transaction<'_>,
    field_id: &str,
) -> Result<HashMap<String, String>, StorageError> {
    let mut names = HashMap::new();
    let mut statement =
        transaction.prepare("SELECT id, name FROM field_options WHERE field_id = ?1")?;
    for row in statement.query_map([field_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })? {
        let (id, name) = row?;
        names.insert(id, name);
    }
    Ok(names)
}
fn old_value_text(
    field: &FieldRow,
    value: Option<&Value>,
    multi: Option<&Vec<String>>,
    option_names: &HashMap<String, String>,
) -> Option<String> {
    if field.field_type == "multi_select" {
        return multi
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| option_names.get(id))
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .filter(|text| !text.is_empty());
    }
    if field.field_type == "select" {
        return value
            .and_then(Value::as_str)
            .and_then(|id| option_names.get(id))
            .cloned();
    }
    value
        .and_then(|value| match value {
            Value::String(text) => Some(text.trim().to_string()),
            Value::Number(number) => Some(number.to_string()),
            Value::Bool(flag) => Some(flag.to_string()),
            _ => None,
        })
        .filter(|text| !text.is_empty())
}
fn converted_value(
    field: &FieldRow,
    next_type: &str,
    text: Option<&str>,
    multi: Option<&Vec<String>>,
    generated: &HashMap<String, String>,
    option_names: &HashMap<String, String>,
) -> Option<Value> {
    if next_type == "select" || next_type == "multi_select" {
        if field.field_type == "select" {
            return text.and_then(|name| {
                option_names
                    .iter()
                    .find(|(_, option_name)| option_name.as_str() == name)
                    .map(|(id, _)| Value::String(id.clone()))
            });
        }
        if field.field_type == "multi_select" {
            return multi
                .and_then(|ids| ids.first())
                .map(|id| Value::String(id.clone()));
        }
        return text.and_then(|name| generated.get(name).map(|id| Value::String(id.clone())));
    }
    let text = text?;
    match next_type {
        "number" => text
            .parse::<f64>()
            .ok()
            .filter(|number| number.is_finite())
            .map(|number| json!(number)),
        "progress" => text
            .parse::<f64>()
            .ok()
            .filter(|number| (0.0..=100.0).contains(number))
            .map(|number| json!(number)),
        "checkbox" => match text {
            "true" => Some(Value::Bool(true)),
            "false" => Some(Value::Bool(false)),
            _ => None,
        },
        "text" | "image" | "file" | "link" | "date" => Some(Value::String(text.to_string())),
        _ => None,
    }
}
fn write_converted_value(
    transaction: &Transaction<'_>,
    record_id: &str,
    field_id: &str,
    field_type: &str,
    value: Option<Value>,
) -> Result<(), StorageError> {
    let Some(value) = value else {
        return Ok(());
    };
    if field_type == "multi_select" {
        if let Some(option_id) = value.as_str() {
            transaction.execute("INSERT INTO multi_select_values (record_id, field_id, option_id, position) VALUES (?1, ?2, ?3, 0)", params![record_id, field_id, option_id])?;
        }
    } else {
        transaction.execute("INSERT INTO cell_values (record_id, field_id, value_json, updated_at) VALUES (?1, ?2, json(?3), ?4)", params![record_id, field_id, value.to_string(), timestamp()])?;
    }
    Ok(())
}


fn to_record_data(
    connection: &Connection,
    record: RecordRow,
    fields: &[FieldSummary],
) -> Result<RecordData, StorageError> {
    let mut values = HashMap::new();
    let mut multi_select_values = HashMap::new();
    for field in fields {
        match field.field_type.as_str() {
            "auto_number" => {
                values.insert(field.id.clone(), json!(record.auto_number));
            }
            "created_time" => {
                values.insert(field.id.clone(), json!(record.created_at));
            }
            "updated_time" => {
                values.insert(field.id.clone(), json!(record.updated_at));
            }
            "multi_select" => {
                values.insert(field.id.clone(), Value::Array(Vec::new()));
                multi_select_values.insert(field.id.clone(), Vec::new());
            }
            _ => {
                values.insert(field.id.clone(), Value::Null);
            }
        }
    }
    let mut statement =
        connection.prepare("SELECT field_id, value_json FROM cell_values WHERE record_id = ?1")?;
    for row in statement.query_map([&record.id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })? {
        let (field_id, json) = row?;
        values.insert(
            field_id,
            serde_json::from_str(&json).map_err(StorageError::from)?,
        );
    }
    let mut multi_statement = connection.prepare("SELECT field_id, option_id FROM multi_select_values WHERE record_id = ?1 ORDER BY position")?;
    for row in multi_statement.query_map([&record.id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })? {
        let (field_id, option_id) = row?;
        multi_select_values
            .entry(field_id.clone())
            .or_default()
            .push(option_id.clone());
        let selected = multi_select_values
            .get(&field_id)
            .cloned()
            .unwrap_or_default();
        values.entry(field_id).and_modify(|value| {
            *value = Value::Array(selected.into_iter().map(Value::String).collect())
        });
    }
    Ok(RecordData {
        id: record.id,
        table_id: record.table_id,
        position: record.position,
        auto_number: record.auto_number,
        created_at: record.created_at,
        updated_at: record.updated_at,
        values,
        multi_select_values,
    })
}



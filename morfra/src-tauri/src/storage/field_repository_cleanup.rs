fn rewrite_option_values(
    transaction: &Transaction<'_>,
    option: &FieldOptionRow,
    mode: &str,
    replacement_id: Option<&str>,
) -> Result<(), StorageError> {
    let rows = transaction
        .prepare("SELECT DISTINCT record_id FROM multi_select_values WHERE field_id = ?1")?
        .query_map([&option.field_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    for record_id in rows {
        let mut ids: Vec<String> = transaction.prepare("SELECT option_id FROM multi_select_values WHERE record_id = ?1 AND field_id = ?2 ORDER BY position")?.query_map(params![record_id, option.field_id], |row| row.get(0))?.collect::<Result<Vec<_>, _>>()?;
        ids.retain(|id| id != &option.id);
        if mode == "replace" {
            if let Some(replacement_id) = replacement_id {
                if !ids.iter().any(|id| id == replacement_id) {
                    ids.push(replacement_id.to_string());
                }
            }
        }
        transaction.execute(
            "DELETE FROM multi_select_values WHERE record_id = ?1 AND field_id = ?2",
            params![record_id, option.field_id],
        )?;
        for (position, id) in ids.iter().enumerate() {
            transaction.execute("INSERT INTO multi_select_values (record_id, field_id, option_id, position) VALUES (?1, ?2, ?3, ?4)", params![record_id, option.field_id, id, position as i64])?;
        }
    }
    if mode == "replace" {
        if let Some(replacement_id) = replacement_id {
            let replacement_json =
                serde_json::to_string(replacement_id).map_err(StorageError::from)?;
            transaction.execute("UPDATE cell_values SET value_json = json(?1), updated_at = ?2 WHERE field_id = ?3 AND json_extract(value_json, '$') = ?4", params![replacement_json, timestamp(), option.field_id, option.id])?;
        }
    } else {
        transaction.execute(
            "DELETE FROM cell_values WHERE field_id = ?1 AND json_extract(value_json, '$') = ?2",
            params![option.field_id, option.id],
        )?;
    }
    Ok(())
}
fn clean_field_references(
    transaction: &Transaction<'_>,
    table_id: &str,
    field_id: &str,
    option: Option<(&str, Option<&str>)>,
) -> Result<(), StorageError> {
    let configs = load_view_configs_tx(transaction, table_id)?;
    for config in configs {
        let Ok(mut value) = serde_json::from_str::<Value>(&config.config_json) else {
            continue;
        };
        clean_json(&mut value, field_id, option);
        let json = serde_json::to_string(&value).map_err(StorageError::from)?;
        transaction.execute(
            "UPDATE view_configs SET config_json = ?1, updated_at = ?2 WHERE view_id = ?3",
            params![json, timestamp(), config.view_id],
        )?;
    }
    Ok(())
}
fn load_view_configs_tx(
    transaction: &Transaction<'_>,
    table_id: &str,
) -> Result<Vec<ViewConfigRow>, StorageError> {
    let mut statement = transaction.prepare("SELECT c.view_id, c.version, c.config_json, c.created_at, c.updated_at FROM view_configs c JOIN views v ON v.id = c.view_id WHERE v.table_id = ?1")?;
    let rows = statement.query_map([table_id], |row| {
        Ok(ViewConfigRow {
            view_id: row.get(0)?,
            version: row.get(1)?,
            config_json: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from)
}
fn clean_json(value: &mut Value, field_id: &str, option: Option<(&str, Option<&str>)>) {
    match value {
        Value::Array(items) => {
            items
                .iter_mut()
                .for_each(|item| clean_json(item, field_id, option));
            items.retain(|item| {
                !((option.is_none() && item.as_str() == Some(field_id)) || matches!(item, Value::Object(map) if map.is_empty() || (is_field_reference(map, field_id) && option.is_none())))
            });
        }
        Value::Object(map) => {
            let is_field = is_field_reference(map, field_id);
            if let Some((old, replacement)) = option {
                if is_field {
                    for key in ["optionId", "option_id", "option", "value", "values"] {
                        if let Some(target) = map.get_mut(key) {
                            replace_json_option(target, old, replacement);
                        }
                    }
                    if replacement.is_none()
                        && ["optionId", "option_id", "option", "value", "values"]
                            .iter()
                            .any(|key| {
                                map.get(*key).is_some_and(|value| {
                                    value.is_null()
                                        || matches!(value, Value::Array(items) if items.is_empty())
                                })
                            })
                    {
                        map.clear();
                    }
                }
            }
            for child in map.values_mut() {
                clean_json(child, field_id, option);
            }
            map.retain(|_, child| !matches!(child, Value::Object(object) if object.is_empty()));
            for key in ["conditions", "rules", "filters", "filterGroups", "groups"] {
                if matches!(map.get(key), Some(Value::Array(items)) if items.is_empty()) {
                    map.remove(key);
                }
            }
            if map.len() == 1 && map.values().next().is_some_and(Value::is_null) {
                map.clear();
            }
        }
        _ => {}
    }
}

fn is_field_reference(map: &serde_json::Map<String, Value>, field_id: &str) -> bool {
    ["fieldId", "field_id", "field"]
        .iter()
        .any(|key| map.get(*key).and_then(Value::as_str) == Some(field_id))
}

fn replace_json_option(value: &mut Value, old: &str, replacement: Option<&str>) {
    match value {
        Value::String(current) if current == old => {
            *value = replacement.map_or(Value::Null, |value| Value::String(value.to_string()))
        }
        Value::Array(items) => {
            for item in items.iter_mut() {
                if item.as_str() == Some(old) {
                    *item =
                        replacement.map_or(Value::Null, |value| Value::String(value.to_string()));
                }
            }
            items.retain(|item| !item.is_null());
        }
        _ => {}
    }
}



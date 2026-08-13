pub fn load_table_data(
    connection: &Connection,
    table_id: &str,
) -> Result<TableDataSnapshot, StorageError> {
    let transaction = connection.unchecked_transaction()?;
    ensure_table(&transaction, table_id)?;
    let table_metadata = transaction
        .query_row(
            "SELECT t.name, (SELECT f.id FROM fields f WHERE f.table_id = t.id AND f.is_title = 1) FROM data_tables t WHERE t.id = ?1",
            [table_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .optional()?
        .ok_or_else(|| StorageError::validation("目标表不存在"))?;
    let title_field_id = table_metadata
        .1
        .ok_or_else(|| StorageError::validation("当前表缺少主标题字段"))?;
    let fields = load_fields(&transaction, table_id)?;
    let records = record_repository::load_records(&transaction, table_id, &fields)?;
    let attachments = load_attachment_metadata(&transaction, table_id)?;
    let snapshot = TableDataSnapshot {
        table_id: table_id.to_string(),
        table_name: table_metadata.0,
        title_field_id,
        fields,
        records,
        attachments,
    };
    transaction.commit()?;
    Ok(snapshot)
}

fn load_attachment_metadata(
    connection: &Connection,
    table_id: &str,
) -> Result<Vec<super::domain::TableAttachmentMetadata>, StorageError> {
    let mut statement = connection.prepare("SELECT a.id, a.record_id, a.field_id, a.original_name, a.media_type FROM attachments a JOIN records r ON r.id = a.record_id WHERE r.table_id = ?1 ORDER BY a.created_at, a.id")?;
    let rows = statement.query_map([table_id], |row| {
        Ok(super::domain::TableAttachmentMetadata {
            id: row.get(0)?,
            record_id: row.get(1)?,
            field_id: row.get(2)?,
            original_name: row.get(3)?,
            media_type: row.get(4)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from)
}

pub fn load_fields(
    connection: &Connection,
    table_id: &str,
) -> Result<Vec<FieldSummary>, StorageError> {
    let mut statement = connection.prepare("SELECT id, table_id, name, field_type, is_title, position, config_json FROM fields WHERE table_id = ?1 ORDER BY position")?;
    let rows = statement.query_map([table_id], |row| {
        let field_id: String = row.get(0)?;
        let mut options_statement = connection.prepare("SELECT id, field_id, name, color, position FROM field_options WHERE field_id = ?1 ORDER BY position")?;
        let options = options_statement.query_map([&field_id], |option| Ok(FieldOptionSummary { id: option.get(0)?, field_id: option.get(1)?, name: option.get(2)?, color: option.get(3)?, position: option.get(4)? }))?.collect::<Result<Vec<_>, _>>()?;
        let config_json: String = row.get(6)?;
        let config = serde_json::from_str(&config_json).map_err(|_| rusqlite::Error::InvalidQuery)?;
        Ok(FieldSummary { id: field_id, table_id: row.get(1)?, name: row.get(2)?, field_type: row.get(3)?, is_title: row.get::<_, i64>(4)? == 1, position: row.get(5)?, config, options })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from)
}

pub fn create_field(
    connection: &mut Connection,
    table_id: &str,
    name: &str,
    field_type: &str,
    config: Value,
) -> Result<String, StorageError> {
    validate_field_type(field_type)?;
    let name = validate_name(name, "字段")?;
    let transaction = connection.transaction()?;
    ensure_table_tx(&transaction, table_id)?;
    let count: i64 = transaction.query_row(
        "SELECT COUNT(*) FROM fields WHERE table_id = ?1",
        [table_id],
        |row| row.get(0),
    )?;
    if count >= 200 {
        return Err(StorageError::validation("每张表最多建立 200 个字段"));
    }
    let position: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM fields WHERE table_id = ?1",
        [table_id],
        |row| row.get(0),
    )?;
    let now = timestamp();
    let field_id = new_id("field");
    transaction.execute("INSERT INTO fields (id, table_id, name, field_type, is_title, position, config_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?7)", params![field_id, table_id, name, field_type, position, normalize_field_config(field_type, config)?, now])?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(field_id)
}

pub fn update_field(
    connection: &mut Connection,
    field_id: &str,
    name: &str,
    field_type: &str,
    config: Value,
) -> Result<FieldBackup, StorageError> {
    validate_field_type(field_type)?;
    let name = validate_name(name, "字段")?;
    let backup = capture_field(connection, field_id)?;
    let transaction = connection.transaction()?;
    let current = load_field_row_tx(&transaction, field_id)?;
    if current.is_title == 1 && field_type != "text" {
        return Err(StorageError::validation("主标题字段只能保持文本类型"));
    }
    if current.field_type != field_type {
        convert_field_values(&transaction, &current, field_type)?;
        if current.field_type == "select" && field_type != "select" {
            transaction.execute("UPDATE table_configs SET activity_field_id = NULL WHERE table_id = ?1 AND activity_field_id = ?2", params![current.table_id, field_id])?;
        }
    }
    transaction.execute("UPDATE fields SET name = ?1, field_type = ?2, config_json = ?3, updated_at = ?4 WHERE id = ?5", params![name, field_type, normalize_field_config(field_type, config)?, timestamp(), field_id])?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(backup)
}

pub fn delete_field(
    connection: &mut Connection,
    field_id: &str,
) -> Result<FieldBackup, StorageError> {
    let backup = capture_field(connection, field_id)?;
    if backup.field.is_title == 1 {
        return Err(StorageError::validation("主标题字段不能删除"));
    }
    let transaction = connection.transaction()?;
    clean_field_references(&transaction, &backup.field.table_id, field_id, None)?;
    transaction.execute("DELETE FROM fields WHERE id = ?1", [field_id])?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(backup)
}

pub fn restore_field(
    connection: &mut Connection,
    backup: &FieldBackup,
) -> Result<(), StorageError> {
    let transaction = connection.transaction()?;
    transaction.execute("DELETE FROM fields WHERE id = ?1", [&backup.field.id])?;
    insert_field(&transaction, &backup.field)?;
    for option in &backup.options {
        insert_option(&transaction, option)?;
    }
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

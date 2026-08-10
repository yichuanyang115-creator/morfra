pub fn load_records(
    connection: &Connection,
    table_id: &str,
    fields: &[FieldSummary],
) -> Result<Vec<RecordData>, StorageError> {
    let mut statement = connection.prepare("SELECT id, table_id, position, auto_number, created_at, updated_at FROM records WHERE table_id = ?1 ORDER BY position")?;
    let rows = statement.query_map([table_id], |row| {
        Ok(RecordRow {
            id: row.get(0)?,
            table_id: row.get(1)?,
            position: row.get(2)?,
            auto_number: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?;
    let records = rows.collect::<Result<Vec<_>, _>>()?;
    records
        .into_iter()
        .map(|record| to_record_data(connection, record, fields))
        .collect()
}

pub fn create_record(
    connection: &mut Connection,
    table_id: &str,
    values: HashMap<String, Value>,
) -> Result<String, StorageError> {
    let fields = load_fields(connection, table_id)?;
    let title_field = fields
        .iter()
        .find(|field| field.is_title)
        .ok_or_else(|| StorageError::validation("当前表缺少主标题字段"))?;
    let title = values
        .get(&title_field.id)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if title.is_none() {
        return Err(StorageError::validation("新建记录必须填写主标题"));
    }
    let transaction = connection.transaction()?;
    ensure_record_table(&transaction, table_id)?;
    let position: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM records WHERE table_id = ?1",
        [table_id],
        |row| row.get(0),
    )?;
    let auto_number: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(auto_number), 0) + 1 FROM records WHERE table_id = ?1",
        [table_id],
        |row| row.get(0),
    )?;
    let id = new_id("record");
    let now = timestamp();
    transaction.execute("INSERT INTO records (id, table_id, position, auto_number, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)", params![id, table_id, position, auto_number, now])?;
    for field in &fields {
        if let Some(value) = values.get(&field.id) {
            let field_row = field_row_from_summary(field)?;
            write_value(&transaction, &id, &field_row, value)?;
        }
    }
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(id)
}

pub fn update_cell(
    connection: &mut Connection,
    record_id: &str,
    field_id: &str,
    value: Value,
) -> Result<RecordBackup, StorageError> {
    let backup = capture_record(connection, record_id)?;
    let transaction = connection.transaction()?;
    let field = load_field(&transaction, field_id)?;
    if field.table_id != backup.record.table_id {
        return Err(super::error::StorageError::validation(
            "字段与记录不属于同一张表",
        ));
    }
    write_value(&transaction, record_id, &field, &value)?;
    let now = timestamp();
    transaction.execute(
        "UPDATE records SET updated_at = ?1 WHERE id = ?2",
        params![now, record_id],
    )?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(backup)
}

pub fn delete_record(
    connection: &mut Connection,
    record_id: &str,
) -> Result<RecordBackup, StorageError> {
    let backup = capture_record(connection, record_id)?;
    let transaction = connection.transaction()?;
    transaction.execute("DELETE FROM records WHERE id = ?1", [record_id])?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(backup)
}

pub fn restore_record(
    connection: &mut Connection,
    backup: &RecordBackup,
) -> Result<(), StorageError> {
    let transaction = connection.transaction()?;
    transaction.execute("DELETE FROM records WHERE id = ?1", [&backup.record.id])?;
    transaction.execute("INSERT INTO records (id, table_id, position, auto_number, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)", params![backup.record.id, backup.record.table_id, backup.record.position, backup.record.auto_number, backup.record.created_at, backup.record.updated_at])?;
    for value in &backup.values {
        transaction.execute("INSERT INTO cell_values (record_id, field_id, value_json, updated_at) VALUES (?1, ?2, ?3, ?4)", params![value.record_id, value.field_id, value.value_json, value.updated_at])?;
    }
    for value in &backup.multi_values {
        transaction.execute("INSERT INTO multi_select_values (record_id, field_id, option_id, position) VALUES (?1, ?2, ?3, ?4)", params![value.record_id, value.field_id, value.option_id, value.position])?;
    }
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(())
}

pub fn capture_record(
    connection: &Connection,
    record_id: &str,
) -> Result<RecordBackup, StorageError> {
    let record = connection.query_row("SELECT id, table_id, position, auto_number, created_at, updated_at FROM records WHERE id = ?1", [record_id], |row| Ok(RecordRow { id: row.get(0)?, table_id: row.get(1)?, position: row.get(2)?, auto_number: row.get(3)?, created_at: row.get(4)?, updated_at: row.get(5)? })).optional()?.ok_or_else(|| StorageError::validation("记录不存在"))?;
    let mut values_statement = connection.prepare(
        "SELECT record_id, field_id, value_json, updated_at FROM cell_values WHERE record_id = ?1",
    )?;
    let values = values_statement
        .query_map([record_id], |row| {
            Ok(CellValueRow {
                record_id: row.get(0)?,
                field_id: row.get(1)?,
                value_json: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let mut multi_statement = connection.prepare("SELECT record_id, field_id, option_id, position FROM multi_select_values WHERE record_id = ?1 ORDER BY position")?;
    let multi_values = multi_statement
        .query_map([record_id], |row| {
            Ok(MultiSelectValueRow {
                record_id: row.get(0)?,
                field_id: row.get(1)?,
                option_id: row.get(2)?,
                position: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(RecordBackup {
        record,
        values,
        multi_values,
    })
}



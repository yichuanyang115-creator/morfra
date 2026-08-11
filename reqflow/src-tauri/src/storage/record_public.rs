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

pub fn reorder_records(
    connection: &mut Connection,
    table_id: &str,
    record_ids: &[String],
) -> Result<BatchBackup, StorageError> {
    let stored_ids = connection
        .prepare("SELECT id FROM records WHERE table_id = ?1 ORDER BY position")?
        .query_map([table_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    let requested = record_ids.iter().cloned().collect::<HashSet<_>>();
    let stored = stored_ids.iter().cloned().collect::<HashSet<_>>();
    if record_ids.len() != requested.len() || requested != stored {
        return Err(StorageError::validation(
            "记录排序必须包含当前表全部且不重复的记录",
        ));
    }
    let backups = stored_ids
        .iter()
        .map(|record_id| capture_record(connection, record_id))
        .collect::<Result<Vec<_>, _>>()?;
    let transaction = connection.transaction()?;
    let temporary_offset: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(position), -1) + ?2 FROM records WHERE table_id = ?1",
        params![table_id, record_ids.len() as i64 + 1],
        |row| row.get(0),
    )?;
    for (position, record_id) in record_ids.iter().enumerate() {
        transaction.execute(
            "UPDATE records SET position = ?1 WHERE id = ?2 AND table_id = ?3",
            params![temporary_offset + position as i64, record_id, table_id],
        )?;
    }
    for (position, record_id) in record_ids.iter().enumerate() {
        transaction.execute(
            "UPDATE records SET position = ?1 WHERE id = ?2 AND table_id = ?3",
            params![position as i64, record_id, table_id],
        )?;
    }
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(BatchBackup {
        table_id: table_id.to_string(),
        records: backups,
        created_record_ids: vec![],
    })
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

pub fn apply_batch_mutation(
    connection: &mut Connection,
    table_id: &str,
    updates: Vec<CellUpdate>,
    new_records: Vec<NewRecord>,
    delete_record_ids: Vec<String>,
) -> Result<BatchBackup, StorageError> {
    let mut affected_ids = updates
        .iter()
        .map(|update| update.record_id.clone())
        .collect::<Vec<_>>();
    affected_ids.extend(delete_record_ids.iter().cloned());
    affected_ids.sort();
    affected_ids.dedup();
    let backups = affected_ids
        .iter()
        .map(|record_id| capture_record(connection, record_id))
        .collect::<Result<Vec<_>, _>>()?;
    if backups
        .iter()
        .any(|backup| backup.record.table_id != table_id)
    {
        return Err(StorageError::validation("批量操作只能作用于同一张表"));
    }

    let fields = load_fields(connection, table_id)?;
    let title_field = fields
        .iter()
        .find(|field| field.is_title)
        .ok_or_else(|| StorageError::validation("当前表缺少主标题字段"))?;
    let transaction = connection.transaction()?;
    ensure_record_table(&transaction, table_id)?;
    let field_map = fields
        .iter()
        .map(|field| Ok((field.id.clone(), field_row_from_summary(field)?)))
        .collect::<Result<HashMap<_, _>, StorageError>>()?;

    for update in &updates {
        let field = field_map
            .get(&update.field_id)
            .ok_or_else(|| StorageError::validation("目标字段不存在或不属于当前表"))?;
        write_value(&transaction, &update.record_id, field, &update.value)?;
        transaction.execute(
            "UPDATE records SET updated_at = ?1 WHERE id = ?2",
            params![timestamp(), update.record_id],
        )?;
    }

    let mut created_record_ids = Vec::new();
    for new_record in &new_records {
        new_record
            .values
            .get(&title_field.id)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| StorageError::validation("自动补行必须包含主标题"))?;
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
        let record_id = new_id("record");
        let now = timestamp();
        transaction.execute("INSERT INTO records (id, table_id, position, auto_number, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)", params![record_id, table_id, position, auto_number, now])?;
        for (field_id, value) in &new_record.values {
            let field = field_map
                .get(field_id)
                .ok_or_else(|| StorageError::validation("新记录包含未知字段"))?;
            write_value(&transaction, &record_id, field, value)?;
        }
        created_record_ids.push(record_id);
    }
    for record_id in &delete_record_ids {
        transaction.execute("DELETE FROM records WHERE id = ?1", [record_id])?;
    }
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(BatchBackup {
        table_id: table_id.to_string(),
        records: backups,
        created_record_ids,
    })
}

pub fn restore_batch_mutation(
    connection: &mut Connection,
    backup: &BatchBackup,
) -> Result<(), StorageError> {
    let transaction = connection.transaction()?;
    for record_id in &backup.created_record_ids {
        transaction.execute("DELETE FROM records WHERE id = ?1", [record_id])?;
    }
    for record_backup in &backup.records {
        transaction.execute(
            "DELETE FROM records WHERE id = ?1",
            [&record_backup.record.id],
        )?;
    }
    for record_backup in &backup.records {
        transaction.execute("INSERT INTO records (id, table_id, position, auto_number, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)", params![record_backup.record.id, record_backup.record.table_id, record_backup.record.position, record_backup.record.auto_number, record_backup.record.created_at, record_backup.record.updated_at])?;
        for value in &record_backup.values {
            transaction.execute("INSERT INTO cell_values (record_id, field_id, value_json, updated_at) VALUES (?1, ?2, ?3, ?4)", params![value.record_id, value.field_id, value.value_json, value.updated_at])?;
        }
        for value in &record_backup.multi_values {
            transaction.execute("INSERT INTO multi_select_values (record_id, field_id, option_id, position) VALUES (?1, ?2, ?3, ?4)", params![value.record_id, value.field_id, value.option_id, value.position])?;
        }
    }
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(())
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

pub fn move_board_card(
    connection: &mut Connection,
    view_id: &str,
    record_id: &str,
    field_id: &str,
    value: Value,
    board_config: Value,
) -> Result<BoardMoveBackup, StorageError> {
    if !board_config.is_object() {
        return Err(StorageError::validation("看板配置必须是对象"));
    }
    let record = capture_record(connection, record_id)?;
    let transaction = connection.transaction()?;
    let view_table_id: String = transaction
        .query_row(
            "SELECT table_id FROM views WHERE id = ?1 AND view_type = 'board'",
            [view_id],
            |row| row.get(0),
        )
        .optional()?
        .ok_or_else(|| StorageError::validation("看板视图不存在"))?;
    if view_table_id != record.record.table_id {
        return Err(StorageError::validation("看板视图与记录不属于同一张表"));
    }
    let field = load_field(&transaction, field_id)?;
    if field.table_id != view_table_id {
        return Err(StorageError::validation("看板分组字段不属于当前表"));
    }
    let config_json: String = transaction.query_row(
        "SELECT config_json FROM view_configs WHERE view_id = ?1",
        [view_id],
        |row| row.get(0),
    )?;
    let mut config: Value = serde_json::from_str(&config_json).map_err(StorageError::from)?;
    config
        .as_object_mut()
        .ok_or_else(|| StorageError::validation("视图配置损坏"))?
        .insert("board".to_string(), board_config);
    write_value(&transaction, record_id, &field, &value)?;
    transaction.execute(
        "UPDATE records SET updated_at = ?1 WHERE id = ?2",
        params![timestamp(), record_id],
    )?;
    transaction.execute(
        "UPDATE view_configs SET config_json = ?1, updated_at = ?2 WHERE view_id = ?3",
        params![
            serde_json::to_string(&config).map_err(StorageError::from)?,
            timestamp(),
            view_id
        ],
    )?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(BoardMoveBackup {
        record,
        view_id: view_id.to_string(),
        config_json,
    })
}

pub fn restore_board_move(
    connection: &mut Connection,
    backup: &BoardMoveBackup,
) -> Result<(), StorageError> {
    let transaction = connection.transaction()?;
    transaction.execute(
        "DELETE FROM records WHERE id = ?1",
        [&backup.record.record.id],
    )?;
    transaction.execute("INSERT INTO records (id, table_id, position, auto_number, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)", params![backup.record.record.id, backup.record.record.table_id, backup.record.record.position, backup.record.record.auto_number, backup.record.record.created_at, backup.record.record.updated_at])?;
    for value in &backup.record.values {
        transaction.execute("INSERT INTO cell_values (record_id, field_id, value_json, updated_at) VALUES (?1, ?2, ?3, ?4)", params![value.record_id, value.field_id, value.value_json, value.updated_at])?;
    }
    for value in &backup.record.multi_values {
        transaction.execute("INSERT INTO multi_select_values (record_id, field_id, option_id, position) VALUES (?1, ?2, ?3, ?4)", params![value.record_id, value.field_id, value.option_id, value.position])?;
    }
    transaction.execute(
        "UPDATE view_configs SET config_json = ?1, updated_at = ?2 WHERE view_id = ?3",
        params![backup.config_json, timestamp(), backup.view_id],
    )?;
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

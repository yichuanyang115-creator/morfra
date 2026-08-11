pub fn load_table_data(
    connection: &Connection,
    table_id: &str,
) -> Result<TableDataSnapshot, StorageError> {
    ensure_table(connection, table_id)?;
    let groups = load_groups(connection, table_id)?;
    let fields = load_fields(connection, table_id)?;
    let records = record_repository::load_records(connection, table_id, &fields)?;
    Ok(TableDataSnapshot {
        table_id: table_id.to_string(),
        groups,
        fields,
        records,
    })
}

pub fn load_groups(
    connection: &Connection,
    table_id: &str,
) -> Result<Vec<FieldGroupSummary>, StorageError> {
    let mut statement = connection.prepare("SELECT id, table_id, name, position FROM field_groups WHERE table_id = ?1 ORDER BY position")?;
    let rows = statement.query_map([table_id], |row| {
        Ok(FieldGroupSummary {
            id: row.get(0)?,
            table_id: row.get(1)?,
            name: row.get(2)?,
            position: row.get(3)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from)
}

pub fn load_fields(
    connection: &Connection,
    table_id: &str,
) -> Result<Vec<FieldSummary>, StorageError> {
    let mut statement = connection.prepare("SELECT f.id, f.table_id, f.group_id, f.name, f.field_type, f.is_title, f.position, f.config_json FROM fields f LEFT JOIN field_groups g ON g.id = f.group_id WHERE f.table_id = ?1 ORDER BY f.is_title DESC, CASE WHEN f.group_id IS NULL THEN 1 ELSE 0 END, COALESCE(g.position, 9223372036854775807), f.position")?;
    let rows = statement.query_map([table_id], |row| {
        let field_id: String = row.get(0)?;
        let mut options_statement = connection.prepare("SELECT id, field_id, name, color, position FROM field_options WHERE field_id = ?1 ORDER BY position")?;
        let options = options_statement.query_map([&field_id], |option| Ok(FieldOptionSummary { id: option.get(0)?, field_id: option.get(1)?, name: option.get(2)?, color: option.get(3)?, position: option.get(4)? }))?.collect::<Result<Vec<_>, _>>()?;
        let config_json: String = row.get(7)?;
        let config = serde_json::from_str(&config_json).map_err(|_| rusqlite::Error::InvalidQuery)?;
        Ok(FieldSummary { id: field_id, table_id: row.get(1)?, group_id: row.get(2)?, name: row.get(3)?, field_type: row.get(4)?, is_title: row.get::<_, i64>(5)? == 1, position: row.get(6)?, config, options })
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
    group_id: Option<&str>,
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
    ensure_unique_name(&transaction, "fields", "table_id", table_id, &name, "字段")?;
    validate_group_tx(&transaction, table_id, group_id)?;
    let position: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM fields WHERE table_id = ?1",
        [table_id],
        |row| row.get(0),
    )?;
    let now = timestamp();
    let field_id = new_id("field");
    transaction.execute("INSERT INTO fields (id, table_id, group_id, name, field_type, is_title, position, config_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?8, ?8)", params![field_id, table_id, group_id, name, field_type, position, normalize_field_config(field_type, config)?, now])?;
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
    group_id: Option<&str>,
) -> Result<FieldBackup, StorageError> {
    validate_field_type(field_type)?;
    let name = validate_name(name, "字段")?;
    let backup = capture_field(connection, field_id)?;
    let transaction = connection.transaction()?;
    let current = load_field_row_tx(&transaction, field_id)?;
    if current.is_title == 1 && field_type != "text" {
        return Err(StorageError::validation("主标题字段只能保持文本类型"));
    }
    if current.is_title == 1 && group_id.is_some() {
        return Err(StorageError::validation("主标题字段不能加入字段组"));
    }
    validate_group_tx(&transaction, &current.table_id, group_id)?;
    ensure_unique_name_excluding(
        &transaction,
        "fields",
        "table_id",
        &current.table_id,
        &name,
        "字段",
        field_id,
    )?;
    if current.field_type != field_type {
        convert_field_values(&transaction, &current, field_type)?;
        if current.field_type == "select" && field_type != "select" {
            transaction.execute("UPDATE table_configs SET activity_field_id = NULL WHERE table_id = ?1 AND activity_field_id = ?2", params![current.table_id, field_id])?;
        }
    }
    transaction.execute("UPDATE fields SET name = ?1, field_type = ?2, group_id = ?3, config_json = ?4, updated_at = ?5 WHERE id = ?6", params![name, field_type, group_id, normalize_field_config(field_type, config)?, timestamp(), field_id])?;
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

pub fn create_group(
    connection: &mut Connection,
    table_id: &str,
    name: &str,
) -> Result<String, StorageError> {
    let name = validate_name(name, "字段组")?;
    let transaction = connection.transaction()?;
    ensure_table_tx(&transaction, table_id)?;
    ensure_unique_name(
        &transaction,
        "field_groups",
        "table_id",
        table_id,
        &name,
        "字段组",
    )?;
    let position: i64 = transaction.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM field_groups WHERE table_id = ?1",
        [table_id],
        |row| row.get(0),
    )?;
    let now = timestamp();
    let group_id = new_id("group");
    transaction.execute("INSERT INTO field_groups (id, table_id, name, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)", params![group_id, table_id, name, position, now])?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(group_id)
}

pub fn rename_group(
    connection: &mut Connection,
    group_id: &str,
    name: &str,
) -> Result<FieldGroupBackup, StorageError> {
    let backup = capture_group(connection, group_id)?;
    let name = validate_name(name, "字段组")?;
    let transaction = connection.transaction()?;
    ensure_unique_name_excluding(
        &transaction,
        "field_groups",
        "table_id",
        &backup.group.table_id,
        &name,
        "字段组",
        group_id,
    )?;
    transaction.execute(
        "UPDATE field_groups SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name, timestamp(), group_id],
    )?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(backup)
}

pub fn restore_group_name(
    connection: &mut Connection,
    group_id: &str,
    name: &str,
) -> Result<(), StorageError> {
    let name = validate_name(name, "字段组")?;
    let transaction = connection.transaction()?;
    let table_id: String = transaction
        .query_row(
            "SELECT table_id FROM field_groups WHERE id = ?1",
            [group_id],
            |row| row.get(0),
        )
        .optional()?
        .ok_or_else(|| StorageError::validation("字段组不存在"))?;
    ensure_unique_name_excluding(
        &transaction,
        "field_groups",
        "table_id",
        &table_id,
        &name,
        "字段组",
        group_id,
    )?;
    transaction.execute(
        "UPDATE field_groups SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name, timestamp(), group_id],
    )?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(())
}

pub fn delete_group(
    connection: &mut Connection,
    group_id: &str,
) -> Result<FieldGroupBackup, StorageError> {
    let backup = capture_group(connection, group_id)?;
    let transaction = connection.transaction()?;
    transaction.execute("DELETE FROM field_groups WHERE id = ?1", [group_id])?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(backup)
}

pub fn restore_group(
    connection: &mut Connection,
    backup: &FieldGroupBackup,
) -> Result<(), StorageError> {
    let transaction = connection.transaction()?;
    transaction.execute("INSERT INTO field_groups (id, table_id, name, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)", params![backup.group.id, backup.group.table_id, backup.group.name, backup.group.position, backup.group.created_at, backup.group.updated_at])?;
    for (field_id, group_id) in &backup.member_fields {
        transaction.execute(
            "UPDATE fields SET group_id = ?1 WHERE id = ?2",
            params![group_id, field_id],
        )?;
    }
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(())
}

pub fn move_field(
    connection: &mut Connection,
    field_id: &str,
    group_id: Option<&str>,
) -> Result<FieldBackup, StorageError> {
    let backup = capture_field(connection, field_id)?;
    if backup.field.is_title == 1 {
        return Err(StorageError::validation("主标题字段不能加入字段组"));
    }
    let transaction = connection.transaction()?;
    validate_group_tx(&transaction, &backup.field.table_id, group_id)?;
    transaction.execute(
        "UPDATE fields SET group_id = ?1, updated_at = ?2 WHERE id = ?3",
        params![group_id, timestamp(), field_id],
    )?;
    touch_project(&transaction)?;
    transaction.commit()?;
    Ok(backup)
}


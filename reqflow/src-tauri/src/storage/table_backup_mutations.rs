pub fn delete_table(
    connection: &mut Connection,
    table_id: &str,
) -> Result<DeletedTable, StorageError> {
    let transaction = connection.transaction()?;
    let count: i64 =
        transaction.query_row("SELECT COUNT(*) FROM data_tables", [], |row| row.get(0))?;
    if count <= 1 {
        return Err(StorageError::validation("项目至少需要保留一张表"));
    }
    let mut backup = capture(&transaction, table_id)?;
    let deleted = transaction.execute("DELETE FROM data_tables WHERE id = ?1", [table_id])?;
    if deleted != 1 {
        return Err(StorageError::new(
            StorageErrorCode::ValidationError,
            "要删除的表不存在",
            false,
        ));
    }
    let deleted_at = timestamp();
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [&deleted_at],
    )?;
    backup.delete_updated_at = deleted_at;
    transaction.commit()?;
    Ok(backup)
}

pub fn restore_table(
    connection: &mut Connection,
    backup: &DeletedTable,
) -> Result<(), StorageError> {
    let transaction = connection.transaction()?;
    restore_table_in_transaction(&transaction, backup)?;
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [timestamp()],
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn restore_table_in_transaction(
    transaction: &Transaction<'_>,
    backup: &DeletedTable,
) -> Result<(), StorageError> {
    let exists: Option<String> = transaction
        .query_row(
            "SELECT id FROM data_tables WHERE id = ?1",
            [&backup.table.id],
            |row| row.get(0),
        )
        .optional()?;
    if exists.is_some() {
        return Err(StorageError::validation("要恢复的表已存在"));
    }
    transaction.execute(
        "UPDATE data_tables SET position = position + 1 WHERE project_id = ?1 AND position >= ?2",
        (&backup.table.project_id, backup.table.position),
    )?;
    transaction.execute(
        "INSERT INTO data_tables (id, project_id, name, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (&backup.table.id, &backup.table.project_id, &backup.table.name, backup.table.position, &backup.table.created_at, &backup.table.updated_at),
    )?;
    transaction.execute("INSERT INTO table_configs (table_id, detail_field_ids_json, updated_at) VALUES (?1, ?2, ?3)", (&backup.table.id, &backup.table_config_json, &backup.table_config_updated_at))?;
    for group in &backup.groups {
        transaction.execute(
            "INSERT INTO field_groups (id, table_id, name, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (&group.id, &group.table_id, &group.name, group.position, &group.created_at, &group.updated_at),
        )?;
    }
    for field in &backup.fields {
        transaction.execute(
            "INSERT INTO fields (id, table_id, group_id, name, field_type, is_title, position, config_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            (&field.id, &field.table_id, &field.group_id, &field.name, &field.field_type, field.is_title, field.position, &field.config_json, &field.created_at, &field.updated_at),
        )?;
    }
    for option in &backup.options {
        transaction.execute(
            "INSERT INTO field_options (id, field_id, name, color, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (&option.id, &option.field_id, &option.name, &option.color, option.position, &option.created_at, &option.updated_at),
        )?;
    }
    for view in &backup.views {
        transaction.execute(
            "INSERT INTO views (id, table_id, name, view_type, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (&view.id, &view.table_id, &view.name, &view.view_type, view.position, &view.created_at, &view.updated_at),
        )?;
    }
    for config in &backup.configs {
        transaction.execute(
            "INSERT INTO view_configs (view_id, version, config_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            (&config.view_id, config.version, &config.config_json, &config.created_at, &config.updated_at),
        )?;
    }
    for record in &backup.records {
        transaction.execute(
            "INSERT INTO records (id, table_id, position, auto_number, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (&record.id, &record.table_id, record.position, record.auto_number, &record.created_at, &record.updated_at),
        )?;
    }
    for value in &backup.values {
        transaction.execute(
            "INSERT INTO cell_values (record_id, field_id, value_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            (&value.record_id, &value.field_id, &value.value_json, &value.updated_at),
        )?;
    }
    for value in &backup.multi_values {
        transaction.execute(
            "INSERT INTO multi_select_values (record_id, field_id, option_id, position) VALUES (?1, ?2, ?3, ?4)",
            (&value.record_id, &value.field_id, &value.option_id, value.position),
        )?;
    }
    for attachment in &backup.attachments {
        transaction.execute("INSERT INTO attachments (id, record_id, field_id, relative_path, original_name, media_type, byte_size, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)", (&attachment.id, &attachment.record_id, &attachment.field_id, &attachment.relative_path, &attachment.original_name, &attachment.media_type, attachment.byte_size, &attachment.created_at))?;
    }
    Ok(())
}

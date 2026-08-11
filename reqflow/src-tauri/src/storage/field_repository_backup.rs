pub fn capture_field(connection: &Connection, field_id: &str) -> Result<FieldBackup, StorageError> {
    let field = load_field_row(connection, field_id)?;
    let options = load_option_rows(connection, field_id)?;
    let values = load_cell_rows(connection, field_id)?;
    let multi_values = load_multi_rows(connection, field_id)?;
    let view_configs = load_view_configs(connection, &field.table_id)?;
    Ok(FieldBackup {
        field,
        options,
        values,
        multi_values,
        view_configs,
    })
}

pub fn capture_group(
    connection: &Connection,
    group_id: &str,
) -> Result<FieldGroupBackup, StorageError> {
    let group = connection.query_row("SELECT id, table_id, name, position, created_at, updated_at FROM field_groups WHERE id = ?1", [group_id], |row| Ok(FieldGroupRow { id: row.get(0)?, table_id: row.get(1)?, name: row.get(2)?, position: row.get(3)?, created_at: row.get(4)?, updated_at: row.get(5)? })).optional()?.ok_or_else(|| StorageError::validation("字段组不存在"))?;
    let mut statement =
        connection.prepare("SELECT id, group_id FROM fields WHERE group_id = ?1")?;
    let member_fields = statement
        .query_map([group_id], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(FieldGroupBackup {
        group,
        member_fields,
    })
}

pub fn capture_option(
    connection: &Connection,
    option_id: &str,
) -> Result<OptionBackup, StorageError> {
    let option = connection.query_row("SELECT id, field_id, name, color, position, created_at, updated_at FROM field_options WHERE id = ?1", [option_id], |row| Ok(FieldOptionRow { id: row.get(0)?, field_id: row.get(1)?, name: row.get(2)?, color: row.get(3)?, position: row.get(4)?, created_at: row.get(5)?, updated_at: row.get(6)? })).optional()?.ok_or_else(|| StorageError::validation("选项不存在"))?;
    Ok(OptionBackup {
        values: load_cell_rows(connection, &option.field_id)?,
        multi_values: load_multi_rows(connection, &option.field_id)?,
        view_configs: load_view_configs(
            connection,
            &table_id_for_field_read(connection, &option.field_id)?,
        )?,
        activity_event_ids: Vec::new(),
        option,
    })
}

fn load_field_row(connection: &Connection, field_id: &str) -> Result<FieldRow, StorageError> {
    connection.query_row("SELECT id, table_id, group_id, name, field_type, is_title, position, config_json, created_at, updated_at FROM fields WHERE id = ?1", [field_id], field_row_from_row).optional()?.ok_or_else(|| StorageError::validation("字段不存在"))
}
fn load_field_row_tx(
    transaction: &Transaction<'_>,
    field_id: &str,
) -> Result<FieldRow, StorageError> {
    transaction.query_row("SELECT id, table_id, group_id, name, field_type, is_title, position, config_json, created_at, updated_at FROM fields WHERE id = ?1", [field_id], field_row_from_row).optional()?.ok_or_else(|| StorageError::validation("字段不存在"))
}
fn field_row_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FieldRow> {
    Ok(FieldRow {
        id: row.get(0)?,
        table_id: row.get(1)?,
        group_id: row.get(2)?,
        name: row.get(3)?,
        field_type: row.get(4)?,
        is_title: row.get(5)?,
        position: row.get(6)?,
        config_json: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}
fn load_option_rows(
    connection: &Connection,
    field_id: &str,
) -> Result<Vec<FieldOptionRow>, StorageError> {
    let mut statement = connection.prepare("SELECT id, field_id, name, color, position, created_at, updated_at FROM field_options WHERE field_id = ?1 ORDER BY position")?;
    let rows = statement.query_map([field_id], |row| {
        Ok(FieldOptionRow {
            id: row.get(0)?,
            field_id: row.get(1)?,
            name: row.get(2)?,
            color: row.get(3)?,
            position: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from)
}
fn load_cell_rows(
    connection: &Connection,
    field_id: &str,
) -> Result<Vec<CellValueRow>, StorageError> {
    let mut statement = connection.prepare(
        "SELECT record_id, field_id, value_json, updated_at FROM cell_values WHERE field_id = ?1",
    )?;
    let rows = statement.query_map([field_id], |row| {
        Ok(CellValueRow {
            record_id: row.get(0)?,
            field_id: row.get(1)?,
            value_json: row.get(2)?,
            updated_at: row.get(3)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from)
}
fn load_multi_rows(
    connection: &Connection,
    field_id: &str,
) -> Result<Vec<MultiSelectValueRow>, StorageError> {
    let mut statement = connection.prepare("SELECT record_id, field_id, option_id, position FROM multi_select_values WHERE field_id = ?1 ORDER BY record_id, position")?;
    let rows = statement.query_map([field_id], |row| {
        Ok(MultiSelectValueRow {
            record_id: row.get(0)?,
            field_id: row.get(1)?,
            option_id: row.get(2)?,
            position: row.get(3)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from)
}
fn load_view_configs(
    connection: &Connection,
    table_id: &str,
) -> Result<Vec<ViewConfigRow>, StorageError> {
    let mut statement = connection.prepare("SELECT c.view_id, c.version, c.config_json, c.created_at, c.updated_at FROM view_configs c JOIN views v ON v.id = c.view_id WHERE v.table_id = ?1")?;
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
fn insert_field(transaction: &Transaction<'_>, field: &FieldRow) -> Result<(), StorageError> {
    transaction.execute("INSERT INTO fields (id, table_id, group_id, name, field_type, is_title, position, config_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)", params![field.id, field.table_id, field.group_id, field.name, field.field_type, field.is_title, field.position, field.config_json, field.created_at, field.updated_at])?;
    Ok(())
}
fn insert_option(
    transaction: &Transaction<'_>,
    option: &FieldOptionRow,
) -> Result<(), StorageError> {
    transaction.execute("INSERT INTO field_options (id, field_id, name, color, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)", params![option.id, option.field_id, option.name, option.color, option.position, option.created_at, option.updated_at])?;
    Ok(())
}
fn restore_view_configs(
    transaction: &Transaction<'_>,
    configs: &[ViewConfigRow],
) -> Result<(), StorageError> {
    for config in configs {
        transaction.execute("UPDATE view_configs SET version = ?1, config_json = ?2, created_at = ?3, updated_at = ?4 WHERE view_id = ?5", params![config.version, config.config_json, config.created_at, config.updated_at, config.view_id])?;
    }
    Ok(())
}

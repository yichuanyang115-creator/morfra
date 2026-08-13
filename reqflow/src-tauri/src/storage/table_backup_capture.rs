fn capture(transaction: &Transaction<'_>, table_id: &str) -> Result<DeletedTable, StorageError> {
    let project_updated_at = transaction.query_row(
        "SELECT updated_at FROM project_meta WHERE id = 'project'",
        [],
        |row| row.get(0),
    )?;
    let table = transaction.query_row(
        "SELECT id, project_id, name, icon, emoji, position, created_at, updated_at FROM data_tables WHERE id = ?1",
        [table_id],
        |row| Ok(TableRow { id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?, icon: row.get(3)?, emoji: row.get(4)?, position: row.get(5)?, created_at: row.get(6)?, updated_at: row.get(7)? }),
    ).optional()?.ok_or_else(|| StorageError::new(StorageErrorCode::ValidationError, "要删除的表不存在", false))?;
    let table_config: (String, String) = transaction
        .query_row(
            "SELECT detail_field_ids_json, updated_at FROM table_configs WHERE table_id = ?1",
            [table_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?
        .unwrap_or_else(|| ("[]".into(), timestamp()));
    let mut fields = Vec::new();
    let mut statement = transaction.prepare("SELECT id, table_id, name, field_type, is_title, position, config_json, created_at, updated_at FROM fields WHERE table_id = ?1 ORDER BY position")?;
    for row in statement.query_map([table_id], |row| {
        Ok(FieldRow {
            id: row.get(0)?,
            table_id: row.get(1)?,
            name: row.get(2)?, field_type: row.get(3)?, is_title: row.get(4)?, position: row.get(5)?, config_json: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)?,
        })
    })? {
        fields.push(row?);
    }
    let mut options = Vec::new();
    let mut statement = transaction.prepare("SELECT o.id, o.field_id, o.name, o.color, o.position, o.created_at, o.updated_at FROM field_options o JOIN fields f ON f.id = o.field_id WHERE f.table_id = ?1 ORDER BY o.field_id, o.position")?;
    for row in statement.query_map([table_id], |row| {
        Ok(FieldOptionRow {
            id: row.get(0)?,
            field_id: row.get(1)?,
            name: row.get(2)?,
            color: row.get(3)?,
            position: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })? {
        options.push(row?);
    }
    let mut views = Vec::new();
    let mut statement = transaction.prepare("SELECT id, table_id, name, view_type, position, created_at, updated_at FROM views WHERE table_id = ?1 ORDER BY position")?;
    for row in statement.query_map([table_id], |row| {
        Ok(ViewRow {
            id: row.get(0)?,
            table_id: row.get(1)?,
            name: row.get(2)?,
            view_type: row.get(3)?,
            position: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })? {
        views.push(row?);
    }
    let mut configs = Vec::new();
    let mut statement = transaction.prepare("SELECT c.view_id, c.version, c.config_json, c.created_at, c.updated_at FROM view_configs c JOIN views v ON v.id = c.view_id WHERE v.table_id = ?1")?;
    for row in statement.query_map([table_id], |row| {
        Ok(ViewConfigRow {
            view_id: row.get(0)?,
            version: row.get(1)?,
            config_json: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })? {
        configs.push(row?);
    }
    let mut records = Vec::new();
    let mut statement = transaction.prepare("SELECT id, table_id, position, auto_number, created_at, updated_at FROM records WHERE table_id = ?1 ORDER BY position")?;
    for row in statement.query_map([table_id], |row| {
        Ok(RecordRow {
            id: row.get(0)?,
            table_id: row.get(1)?,
            position: row.get(2)?,
            auto_number: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })? {
        records.push(row?);
    }
    let mut values = Vec::new();
    let mut statement = transaction.prepare("SELECT c.record_id, c.field_id, c.value_json, c.updated_at FROM cell_values c JOIN records r ON r.id = c.record_id WHERE r.table_id = ?1")?;
    for row in statement.query_map([table_id], |row| {
        Ok(CellValueRow {
            record_id: row.get(0)?,
            field_id: row.get(1)?,
            value_json: row.get(2)?,
            updated_at: row.get(3)?,
        })
    })? {
        values.push(row?);
    }
    let mut multi_values = Vec::new();
    let mut statement = transaction.prepare("SELECT m.record_id, m.field_id, m.option_id, m.position FROM multi_select_values m JOIN records r ON r.id = m.record_id WHERE r.table_id = ?1 ORDER BY m.record_id, m.position")?;
    for row in statement.query_map([table_id], |row| {
        Ok(MultiSelectValueRow {
            record_id: row.get(0)?,
            field_id: row.get(1)?,
            option_id: row.get(2)?,
            position: row.get(3)?,
        })
    })? {
        multi_values.push(row?);
    }
    let mut attachments = Vec::new();
    let mut statement = transaction.prepare("SELECT a.id, a.record_id, a.field_id, a.relative_path, a.original_name, a.media_type, a.byte_size, a.created_at FROM attachments a JOIN records r ON r.id = a.record_id WHERE r.table_id = ?1 ORDER BY a.created_at")?;
    for row in statement.query_map([table_id], |row| Ok(AttachmentRow { id: row.get(0)?, record_id: row.get(1)?, field_id: row.get(2)?, relative_path: row.get(3)?, original_name: row.get(4)?, media_type: row.get(5)?, byte_size: row.get(6)?, created_at: row.get(7)? }))? { attachments.push(row?); }
    Ok(DeletedTable {
        table,
        project_updated_at,
        delete_updated_at: String::new(),
        table_config_json: table_config.0,
        table_config_updated_at: table_config.1,
        fields,
        options,
        views,
        configs,
        records,
        values,
        multi_values,
        attachments,
    })
}

pub fn reorder_fields(
    connection: &mut Connection,
    table_id: &str,
    ids: &[String],
) -> Result<(), StorageError> {
    let title_id: String = connection
        .query_row(
            "SELECT id FROM fields WHERE table_id = ?1 AND is_title = 1",
            [table_id],
            |row| row.get(0),
        )
        .map_err(StorageError::from)?;
    if ids.first() != Some(&title_id) {
        return Err(StorageError::validation("主标题字段必须保持在首列"));
    }
    reorder(
        connection,
        "fields",
        "table_id = ?1",
        Some(table_id),
        ids,
        "字段",
    )
}

pub fn reorder_field_options(
    connection: &mut Connection,
    field_id: &str,
    ids: &[String],
) -> Result<(), StorageError> {
    reorder(
        connection,
        "field_options",
        "field_id = ?1",
        Some(field_id),
        ids,
        "字段选项",
    )
}


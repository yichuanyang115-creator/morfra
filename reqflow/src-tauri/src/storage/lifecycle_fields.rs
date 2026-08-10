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
    let actual_scopes = field_scope_order(connection, table_id)?;
    let actual_scope_sequence = field_scope_sequence(connection, table_id)?;
    let mut requested_scopes: HashMap<Option<String>, HashSet<String>> = HashMap::new();
    let mut requested_scope_sequence = Vec::new();
    for id in ids.iter().skip(1) {
        let group_id: Option<String> = connection
            .query_row(
                "SELECT group_id FROM fields WHERE id = ?1 AND table_id = ?2",
                params![id, table_id],
                |row| row.get(0),
            )
            .map_err(StorageError::from)?;
        requested_scopes
            .entry(group_id.clone())
            .or_default()
            .insert(id.clone());
        requested_scope_sequence.push(group_id);
    }
    let actual_without_title: HashMap<Option<String>, HashSet<String>> = actual_scopes
        .into_iter()
        .map(|(group_id, values)| {
            (
                group_id,
                values.into_iter().filter(|id| id != &title_id).collect(),
            )
        })
        .collect();
    let compact = |sequence: Vec<Option<String>>| {
        sequence
            .into_iter()
            .fold(Vec::<Option<String>>::new(), |mut compacted, group_id| {
                if compacted.last() != Some(&group_id) {
                    compacted.push(group_id);
                }
                compacted
            })
    };
    if requested_scopes != actual_without_title
        || compact(requested_scope_sequence)
            != compact(
                actual_scope_sequence
                    .into_iter()
                    .skip(1)
                    .map(|(_, group_id)| group_id)
                    .collect(),
            )
    {
        return Err(StorageError::validation(
            "字段排序只能调整同一字段组内的字段",
        ));
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

fn field_scope_order(
    connection: &Connection,
    table_id: &str,
) -> Result<HashMap<Option<String>, Vec<String>>, StorageError> {
    let mut statement = connection.prepare("SELECT f.id, f.group_id, f.is_title FROM fields f LEFT JOIN field_groups g ON g.id = f.group_id WHERE f.table_id = ?1 ORDER BY f.is_title DESC, CASE WHEN f.group_id IS NULL THEN 1 ELSE 0 END, COALESCE(g.position, 9223372036854775807), f.position")?;
    let mut scopes = HashMap::new();
    for row in statement.query_map([table_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })? {
        let (id, group_id, _) = row?;
        scopes.entry(group_id).or_insert_with(Vec::new).push(id);
    }
    Ok(scopes)
}

fn field_scope_sequence(
    connection: &Connection,
    table_id: &str,
) -> Result<Vec<(String, Option<String>)>, StorageError> {
    let mut statement = connection.prepare("SELECT f.id, f.group_id FROM fields f LEFT JOIN field_groups g ON g.id = f.group_id WHERE f.table_id = ?1 ORDER BY f.is_title DESC, CASE WHEN f.group_id IS NULL THEN 1 ELSE 0 END, COALESCE(g.position, 9223372036854775807), f.position")?;
    let rows = statement
        .query_map([table_id], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>, _>>();
    rows.map_err(StorageError::from)
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



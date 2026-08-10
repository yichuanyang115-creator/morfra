#[test]
fn invalid_cell_update_is_atomic_and_type_conversion_is_undoable_by_backup() {
    let (mut connection, table_id) = setup();
    let field_id =
        field_repository::create_field(&mut connection, &table_id, "分数", "text", json!({}), None)
            .expect("field");
    let mut values = HashMap::new();
    values.insert(title_id(&connection, &table_id), json!("第一条"));
    values.insert(field_id.clone(), json!("42"));
    let record_id =
        record_repository::create_record(&mut connection, &table_id, values).expect("record");
    let record_before = record_repository::capture_record(&connection, &record_id).expect("backup");
    let error = record_repository::update_cell(&mut connection, &record_id, &field_id, json!(150))
        .expect_err("text accepts no number");
    assert_eq!(
        error.code,
        crate::storage::error::StorageErrorCode::ValidationError
    );
    field_repository::update_field(
        &mut connection,
        &field_id,
        "分数",
        "number",
        json!({}),
        None,
    )
    .expect("convert");
    assert_eq!(
        data(&connection, &table_id).records[0].values[&field_id],
        json!(42.0)
    );
    record_repository::restore_record(&mut connection, &record_before).expect("restore record");
    assert_eq!(
        data(&connection, &table_id).records[0].values[&field_id],
        json!("42")
    );
}



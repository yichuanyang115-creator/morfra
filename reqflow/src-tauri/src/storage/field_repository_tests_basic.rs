#[test]
fn creates_fields_options_records_and_reads_typed_values() {
    let (mut connection, table_id) = setup();
    let field_id = field_repository::create_field(
        &mut connection,
        &table_id,
        "进度",
        "progress",
        json!({}),
    )
    .expect("field");
    let option_field_id = field_repository::create_field(
        &mut connection,
        &table_id,
        "状态",
        "select",
        json!({}),
    )
    .expect("select field");
    let option_id =
        field_repository::create_option(&mut connection, &option_field_id, "进行中", Some("blue"))
            .expect("option");
    let mut values = HashMap::new();
    values.insert(title_id(&connection, &table_id), json!("第一条"));
    values.insert(field_id.clone(), json!(75));
    values.insert(option_field_id.clone(), json!(option_id));
    record_repository::create_record(&mut connection, &table_id, values).expect("record");
    let snapshot = data(&connection, &table_id);
    assert_eq!(snapshot.records.len(), 1);
    assert_eq!(snapshot.records[0].values[&field_id], json!(75.0));
    assert_eq!(
        snapshot.records[0].values[&option_field_id],
        json!(option_id)
    );
}

#[test]
fn field_names_can_repeat_and_are_distinguished_by_id() {
    let (mut connection, table_id) = setup();
    let first = field_repository::create_field(&mut connection, &table_id, "文本", "text", json!({})).expect("first field");
    let second = field_repository::create_field(&mut connection, &table_id, "文本", "number", json!({})).expect("second field");
    assert_ne!(first, second);
    field_repository::update_field(&mut connection, &second, "文本", "number", json!({})).expect("keep duplicate name");
    let duplicate_count = data(&connection, &table_id).fields.iter().filter(|field| field.name == "文本").count();
    assert_eq!(duplicate_count, 2);
}

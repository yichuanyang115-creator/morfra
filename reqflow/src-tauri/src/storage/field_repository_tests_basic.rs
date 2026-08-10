#[test]
fn creates_groups_options_records_and_reads_typed_values() {
    let (mut connection, table_id) = setup();
    let group_id =
        field_repository::create_group(&mut connection, &table_id, "执行信息").expect("group");
    let field_id = field_repository::create_field(
        &mut connection,
        &table_id,
        "进度",
        "progress",
        json!({}),
        Some(&group_id),
    )
    .expect("field");
    let option_field_id = field_repository::create_field(
        &mut connection,
        &table_id,
        "状态",
        "select",
        json!({}),
        None,
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
    assert_eq!(snapshot.groups[0].name, "执行信息");
    assert_eq!(snapshot.records.len(), 1);
    assert_eq!(snapshot.records[0].values[&field_id], json!(75.0));
    assert_eq!(
        snapshot.records[0].values[&option_field_id],
        json!(option_id)
    );
}



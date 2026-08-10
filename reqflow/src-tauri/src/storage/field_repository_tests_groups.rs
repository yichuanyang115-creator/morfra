#[test]
fn field_config_controls_new_options_and_title_group_invariant() {
    let (mut connection, table_id) = setup();
    let title = title_id(&connection, &table_id);
    let group_id = field_repository::create_group(&mut connection, &table_id, "组").expect("group");
    assert!(field_repository::update_field(
        &mut connection,
        &title,
        "标题",
        "text",
        json!({}),
        Some(&group_id)
    )
    .is_err());
    let field_id = field_repository::create_field(
        &mut connection,
        &table_id,
        "状态",
        "select",
        json!({}),
        None,
    )
    .expect("field");
    let mut values = HashMap::new();
    values.insert(title, json!("记录"));
    values.insert(field_id.clone(), json!("自动新增"));
    let record_id =
        record_repository::create_record(&mut connection, &table_id, values).expect("record");
    let snapshot = data(&connection, &table_id);
    let generated_id = snapshot.records[0].values[&field_id]
        .as_str()
        .expect("option id")
        .to_string();
    assert_eq!(
        snapshot
            .fields
            .iter()
            .find(|field| field.id == field_id)
            .expect("field")
            .options[0]
            .name,
        "自动新增"
    );
    field_repository::update_field(
        &mut connection,
        &field_id,
        "状态",
        "select",
        json!({"allowCreate": false}),
        None,
    )
    .expect("disable create");
    assert!(record_repository::update_cell(
        &mut connection,
        &record_id,
        &field_id,
        json!("另一个")
    )
    .is_err());
    assert_eq!(
        data(&connection, &table_id).records[0].values[&field_id],
        json!(generated_id)
    );
}



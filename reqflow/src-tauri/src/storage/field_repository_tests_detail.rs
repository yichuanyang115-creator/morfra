#[test]
fn detail_fields_are_persisted_and_view_option_clear_removes_nested_rules() {
    let (mut connection, table_id) = setup();
    let title = title_id(&connection, &table_id);
    let detail =
        field_repository::create_field(&mut connection, &table_id, "详情", "text", json!({}), None)
            .expect("detail");
    let select = field_repository::create_field(
        &mut connection,
        &table_id,
        "状态",
        "select",
        json!({}),
        None,
    )
    .expect("select");
    let old_option = field_repository::create_option(&mut connection, &select, "旧", Some("red"))
        .expect("old option");
    let view_id: String = connection
        .query_row(
            "SELECT id FROM views WHERE table_id = ?1",
            [&table_id],
            |row| row.get(0),
        )
        .expect("view");
    lifecycle::update_detail_fields(
        &mut connection,
        &table_id,
        &[detail.clone(), select.clone()],
    )
    .expect("save details");
    assert_eq!(
        lifecycle::load_detail_fields(&connection, &table_id).expect("load details"),
        vec![detail, select.clone()]
    );
    lifecycle::update_view_config(&mut connection, &view_id, json!({"fieldIds": [title], "filterGroups": [{"conditions": [{"field_id": select, "option": old_option}]}]})).expect("save rule");
    field_repository::delete_option(&mut connection, &old_option, "clear", None)
        .expect("clear option");
    let config = lifecycle::load_view_config(&connection, &view_id).expect("load cleaned config");
    assert_eq!(config["fieldIds"], json!([title]));
    assert!(config.get("filterGroups").is_none());
}


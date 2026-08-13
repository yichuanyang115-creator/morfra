#[test]
fn used_option_requires_strategy_and_clear_removes_only_that_option() {
    let (mut connection, table_id) = setup();
    let field_id = field_repository::create_field(
        &mut connection,
        &table_id,
        "状态",
        "select",
        json!({}),
    )
    .expect("field");
    let option_id = field_repository::create_option(&mut connection, &field_id, "旧", Some("red"))
        .expect("old option");
    let replacement_id =
        field_repository::create_option(&mut connection, &field_id, "新", Some("blue"))
            .expect("replacement");
    let mut values = HashMap::new();
    values.insert(title_id(&connection, &table_id), json!("第一条"));
    values.insert(field_id.clone(), json!(option_id));
    record_repository::create_record(&mut connection, &table_id, values).expect("record");
    let view_id: String = connection.query_row("SELECT id FROM views WHERE table_id = ?1 LIMIT 1", [&table_id], |row| row.get(0)).expect("view");
    let config = json!({ "filters": [{ "fieldId": field_id, "value": option_id }, { "fieldId": field_id, "value": option_id }], "note": format!("prefix-{option_id}-suffix") });
    connection.execute("UPDATE view_configs SET config_json = ?1 WHERE view_id = ?2", rusqlite::params![config.to_string(), view_id]).expect("view config");
    let usage = field_repository::option_usage(&connection, &option_id).expect("usage");
    assert_eq!(usage.record_count, 1);
    assert_eq!(usage.view_rule_count, 2);
    assert!(field_repository::delete_option(&mut connection, &option_id, "delete", None).is_err());
    field_repository::delete_option(
        &mut connection,
        &option_id,
        "replace",
        Some(&replacement_id),
    )
    .expect("replace");
    assert_eq!(
        data(&connection, &table_id).records[0].values[&field_id],
        json!(replacement_id)
    );
}

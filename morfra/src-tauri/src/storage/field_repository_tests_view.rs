#[test]
fn view_field_display_config_is_atomic_and_keeps_title_visible() {
    let (mut connection, table_id) = setup();
    let title = title_id(&connection, &table_id);
    let view_id: String = connection
        .query_row(
            "SELECT id FROM views WHERE table_id = ?1",
            [&table_id],
            |row| row.get(0),
        )
        .expect("view");
    lifecycle::update_view_config(&mut connection, &view_id, json!({"fieldIds": [title]}))
        .expect("display config");
    let config = lifecycle::load_view_config(&connection, &view_id).expect("load config");
    assert_eq!(config["fieldIds"], json!([title]));
    assert!(lifecycle::update_view_config(
        &mut connection,
        &view_id,
        json!({"fieldIds": ["missing"]})
    )
    .is_err());
    assert!(lifecycle::update_view_config(
        &mut connection,
        &view_id,
        json!({"fieldIds": ["missing", title]})
    )
    .is_err());
    assert_eq!(
        lifecycle::load_view_config(&connection, &view_id).expect("unchanged")["fieldIds"],
        json!([title])
    );
}



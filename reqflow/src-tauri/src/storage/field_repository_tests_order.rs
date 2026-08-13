#[test]
fn ordering_rejects_partial_lists_and_preserves_title_first() {
    let (mut connection, table_id) = setup();
    let title = title_id(&connection, &table_id);
    let first =
        field_repository::create_field(&mut connection, &table_id, "一", "text", json!({}))
            .expect("first");
    let second =
        field_repository::create_field(&mut connection, &table_id, "二", "text", json!({}))
            .expect("second");
    assert!(lifecycle::reorder_fields(
        &mut connection,
        &table_id,
        std::slice::from_ref(&first)
    )
    .is_err());
    assert!(lifecycle::reorder_fields(
        &mut connection,
        &table_id,
        &[first.clone(), title.clone(), second.clone()]
    )
    .is_err());
    lifecycle::reorder_fields(
        &mut connection,
        &table_id,
        &[title.clone(), second.clone(), first.clone()],
    )
    .expect("reorder");
    let fields = data(&connection, &table_id).fields;
    assert_eq!(
        fields
            .iter()
            .map(|field| field.id.as_str())
            .collect::<Vec<_>>(),
        vec![title.as_str(), second.as_str(), first.as_str()]
    );
}

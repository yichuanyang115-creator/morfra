#[test]
fn field_ordering_allows_reordering_across_the_plain_field_sequence() {
    let (mut connection, table_id) = setup();
    let title = title_id(&connection, &table_id);
    let a1 = field_repository::create_field(
        &mut connection,
        &table_id,
        "A1",
        "text",
        json!({}),
    )
    .expect("A1");
    let a2 = field_repository::create_field(
        &mut connection,
        &table_id,
        "A2",
        "text",
        json!({}),
    )
    .expect("A2");
    let b1 = field_repository::create_field(
        &mut connection,
        &table_id,
        "B1",
        "text",
        json!({}),
    )
    .expect("B1");
    let ungrouped = field_repository::create_field(
        &mut connection,
        &table_id,
        "未分组",
        "text",
        json!({}),
    )
    .expect("ungrouped");
    lifecycle::reorder_fields(
        &mut connection,
        &table_id,
        &[title, a2.clone(), a1.clone(), b1, ungrouped],
    )
    .expect("plain field reorder");
    let fields = data(&connection, &table_id).fields;
    assert_eq!(
        fields
            .iter()
            .map(|field| field.id.as_str())
            .collect::<Vec<_>>(),
        vec![
            fields[0].id.as_str(),
            a2.as_str(),
            a1.as_str(),
            fields[3].id.as_str(),
            fields[4].id.as_str()
        ]
    );
}

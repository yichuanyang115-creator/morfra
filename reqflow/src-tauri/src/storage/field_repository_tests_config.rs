#[test]
fn field_ordering_keeps_group_blocks_and_allows_reordering_inside_a_group() {
    let (mut connection, table_id) = setup();
    let title = title_id(&connection, &table_id);
    let group_a = field_repository::create_group(&mut connection, &table_id, "A").expect("group A");
    let group_b = field_repository::create_group(&mut connection, &table_id, "B").expect("group B");
    let a1 = field_repository::create_field(
        &mut connection,
        &table_id,
        "A1",
        "text",
        json!({}),
        Some(&group_a),
    )
    .expect("A1");
    let a2 = field_repository::create_field(
        &mut connection,
        &table_id,
        "A2",
        "text",
        json!({}),
        Some(&group_a),
    )
    .expect("A2");
    let b1 = field_repository::create_field(
        &mut connection,
        &table_id,
        "B1",
        "text",
        json!({}),
        Some(&group_b),
    )
    .expect("B1");
    let ungrouped = field_repository::create_field(
        &mut connection,
        &table_id,
        "未分组",
        "text",
        json!({}),
        None,
    )
    .expect("ungrouped");
    assert!(lifecycle::reorder_fields(
        &mut connection,
        &table_id,
        &[
            title.clone(),
            a1.clone(),
            b1.clone(),
            a2.clone(),
            ungrouped.clone()
        ]
    )
    .is_err());
    lifecycle::reorder_fields(
        &mut connection,
        &table_id,
        &[title, a2.clone(), a1.clone(), b1, ungrouped],
    )
    .expect("within group reorder");
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



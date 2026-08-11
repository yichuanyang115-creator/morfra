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

#[test]
fn board_move_updates_record_and_view_config_in_one_undoable_backup() {
    let (mut connection, table_id) = setup();
    let status_id =
        field_repository::create_field(&mut connection, &table_id, "状态", "text", json!({}), None)
            .expect("status field");
    let mut values = HashMap::new();
    values.insert(title_id(&connection, &table_id), json!("第一条"));
    values.insert(status_id.clone(), json!("待办"));
    let record_id =
        record_repository::create_record(&mut connection, &table_id, values).expect("record");
    lifecycle::create_view(&mut connection, &table_id, "看板", "board").expect("board");
    let view_id: String = connection
        .query_row(
            "SELECT id FROM views WHERE table_id = ?1 AND view_type = 'board'",
            [&table_id],
            |row| row.get(0),
        )
        .expect("view");
    let backup = record_repository::move_board_card(&mut connection, &view_id, &record_id, &status_id, json!("完成"), json!({"groupFieldId": status_id, "fieldIds": [], "columnOrder": ["完成"], "collapsedKeys": [], "cardPositions": {"完成": [record_id]}})).expect("move");
    assert_eq!(
        data(&connection, &table_id).records[0].values[&status_id],
        json!("完成")
    );
    assert_eq!(
        lifecycle::load_view_config(&connection, &view_id).expect("config")["board"]
            ["cardPositions"]["完成"][0],
        json!(record_id)
    );
    let mut undo = crate::storage::undo::UndoStack::default();
    undo.push(crate::storage::undo::UndoAction::RestoreBoardMove { backup });
    undo.undo(&mut connection).expect("undo");
    assert_eq!(
        data(&connection, &table_id).records[0].values[&status_id],
        json!("待办")
    );
    assert!(lifecycle::load_view_config(&connection, &view_id)
        .expect("restored config")
        .get("board")
        .is_none());
}

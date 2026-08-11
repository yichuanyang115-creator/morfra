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

#[test]
fn activity_tracks_bound_select_changes_with_snapshots_and_undo() {
    let (mut connection, table_id) = setup();
    let title = title_id(&connection, &table_id);
    let stage = field_repository::create_field(&mut connection, &table_id, "阶段", "select", json!({"allowCreate": false}), None).expect("stage");
    let draft = field_repository::create_option(&mut connection, &stage, "草稿", Some("gray")).expect("draft");
    let review = field_repository::create_option(&mut connection, &stage, "评审", Some("blue")).expect("review");
    let record = record_repository::create_record(&mut connection, &table_id, HashMap::from([(title, json!("需求")), (stage.clone(), json!(draft))])).expect("record");
    let transaction = connection.transaction().expect("binding transaction");
    crate::storage::activity_repository::bind_activity_field(&transaction, &table_id, Some(&stage)).expect("bind");
    transaction.commit().expect("commit binding");

    let backup = record_repository::update_cell(&mut connection, &record, &stage, json!(review)).expect("change");
    let events = crate::storage::activity_repository::load_events(&connection, &record).expect("events");
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].field_name_snapshot, "阶段");
    assert_eq!(events[0].from_value_snapshot.as_deref(), Some("草稿"));
    assert_eq!(events[0].to_value_snapshot.as_deref(), Some("评审"));

    record_repository::restore_record(&mut connection, &backup).expect("undo");
    assert!(crate::storage::activity_repository::load_events(&connection, &record).expect("restored events").is_empty());
}

#[test]
fn converting_or_deleting_bound_field_stops_tracking_but_keeps_history() {
    let (mut connection, table_id) = setup();
    let title = title_id(&connection, &table_id);
    let stage = field_repository::create_field(&mut connection, &table_id, "阶段", "select", json!({"allowCreate": false}), None).expect("stage");
    let draft = field_repository::create_option(&mut connection, &stage, "草稿", Some("gray")).expect("draft");
    let review = field_repository::create_option(&mut connection, &stage, "评审", Some("blue")).expect("review");
    let record = record_repository::create_record(&mut connection, &table_id, HashMap::from([(title, json!("需求")), (stage.clone(), json!(draft))])).expect("record");
    let transaction = connection.transaction().expect("binding transaction");
    crate::storage::activity_repository::bind_activity_field(&transaction, &table_id, Some(&stage)).expect("bind");
    transaction.commit().expect("commit binding");
    record_repository::update_cell(&mut connection, &record, &stage, json!(review)).expect("event");

    field_repository::update_field(&mut connection, &stage, "阶段", "text", json!({}), None).expect("convert");
    let transaction = connection.transaction().expect("read binding");
    assert!(crate::storage::activity_repository::activity_field_id(&transaction, &table_id).expect("binding").is_none());
    drop(transaction);
    let events = crate::storage::activity_repository::load_events(&connection, &record).expect("history");
    assert_eq!(events[0].field_name_snapshot, "阶段");
    assert_eq!(events[0].to_value_snapshot.as_deref(), Some("评审"));
}

#[test]
fn activity_note_comments_and_manual_delete_share_the_node_lifecycle() {
    let (mut connection, table_id) = setup();
    let title = title_id(&connection, &table_id);
    let stage = field_repository::create_field(&mut connection, &table_id, "阶段", "select", json!({"allowCreate": false}), None).expect("stage");
    let draft = field_repository::create_option(&mut connection, &stage, "草稿", Some("gray")).expect("draft");
    let review = field_repository::create_option(&mut connection, &stage, "评审", Some("blue")).expect("review");
    let record = record_repository::create_record(&mut connection, &table_id, HashMap::from([(title, json!("需求")), (stage.clone(), json!(draft))])).expect("record");
    let transaction = connection.transaction().expect("binding transaction");
    crate::storage::activity_repository::bind_activity_field(&transaction, &table_id, Some(&stage)).expect("bind");
    transaction.commit().expect("commit binding");
    record_repository::update_cell(&mut connection, &record, &stage, json!(review)).expect("event");
    let event = crate::storage::activity_repository::load_events(&connection, &record).expect("event").pop().expect("event row");
    crate::storage::activity_repository::update_note(&mut connection, &event.id, Some("已评审")).expect("note");
    crate::storage::activity_repository::create_comment(&mut connection, &event.id, "确认范围").expect("comment");
    let event = crate::storage::activity_repository::load_events(&connection, &record).expect("event").pop().expect("event row");
    assert_eq!(event.note.as_deref(), Some("已评审"));
    assert_eq!(event.comments[0].content, "确认范围");
    let undo = record_repository::update_cell(&mut connection, &record, &stage, json!(draft)).expect("second event");
    record_repository::restore_record(&mut connection, &undo).expect("undo second event");
    let restored = crate::storage::activity_repository::load_events(&connection, &record).expect("restored event").pop().expect("node");
    assert_eq!(restored.comments[0].content, "确认范围");
    crate::storage::activity_repository::delete_event(&mut connection, &event.id).expect("delete");
    assert!(crate::storage::activity_repository::load_events(&connection, &record).expect("events").is_empty());
}

#[test]
fn replacing_or_clearing_a_bound_select_option_creates_activity_nodes_and_undo_removes_them() {
    let (mut connection, table_id) = setup();
    let title = title_id(&connection, &table_id);
    let stage = field_repository::create_field(&mut connection, &table_id, "阶段", "select", json!({"allowCreate": false}), None).expect("stage");
    let draft = field_repository::create_option(&mut connection, &stage, "草稿", Some("gray")).expect("draft");
    let review = field_repository::create_option(&mut connection, &stage, "评审", Some("blue")).expect("review");
    let record = record_repository::create_record(&mut connection, &table_id, HashMap::from([(title, json!("需求")), (stage.clone(), json!(draft.clone()))])).expect("record");
    let transaction = connection.transaction().expect("binding transaction");
    crate::storage::activity_repository::bind_activity_field(&transaction, &table_id, Some(&stage)).expect("bind");
    transaction.commit().expect("commit binding");
    let backup = field_repository::delete_option(&mut connection, &draft, "replace", Some(&review)).expect("replace");
    let events = crate::storage::activity_repository::load_events(&connection, &record).expect("events");
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].from_value_snapshot.as_deref(), Some("草稿"));
    assert_eq!(events[0].to_value_snapshot.as_deref(), Some("评审"));
    field_repository::restore_option(&mut connection, &backup).expect("undo replace");
    assert!(crate::storage::activity_repository::load_events(&connection, &record).expect("events after undo").is_empty());
}

#[test]
fn requirement_detail_content_round_trips_and_cascades_with_its_record() {
    let (mut connection, table_id) = setup();
    let title = title_id(&connection, &table_id);
    let record = record_repository::create_record(&mut connection, &table_id, HashMap::from([(title, json!("需求"))])).expect("record");
    let content = crate::storage::detail_content_repository::RecordDetailContentInput {
        body: "# 背景".to_string(),
        deliverables: vec![crate::storage::detail_content_repository::DeliverableContent { id: "deliverable-1".to_string(), name: "原型".to_string(), checked: false, attach: None, created_at: "now".to_string() }],
        tasks: vec![crate::storage::detail_content_repository::TaskContent { id: "task-1".to_string(), name: "开发".to_string(), assignee: String::new(), deadline: String::new(), progress: None, status: "todo".to_string(), blocked: false, block_note: String::new(), created_at: "now".to_string() }],
        acceptance: vec![crate::storage::detail_content_repository::AcceptanceContent { id: "acceptance-1".to_string(), desc: "可创建需求".to_string(), result: "unverified".to_string(), fail_note: String::new(), created_at: "now".to_string() }],
    };
    crate::storage::detail_content_repository::save_record_detail_content(&mut connection, &record, content).expect("save content");
    let loaded = crate::storage::detail_content_repository::load_record_detail_content(&connection, &record).expect("load content");
    assert_eq!(loaded.body, "# 背景");
    assert_eq!(loaded.deliverables[0].name, "原型");
    assert_eq!(loaded.tasks[0].status, "todo");
    assert_eq!(loaded.acceptance[0].desc, "可创建需求");
    let backup = record_repository::delete_record(&mut connection, &record).expect("delete record");
    let count: i64 = connection.query_row("SELECT COUNT(*) FROM record_detail_contents WHERE record_id = ?1", [&record], |row| row.get(0)).expect("detail content count");
    assert_eq!(count, 0);
    record_repository::restore_record(&mut connection, &backup).expect("restore record");
    assert_eq!(crate::storage::detail_content_repository::load_record_detail_content(&connection, &record).expect("restored content").body, "# 背景");
}

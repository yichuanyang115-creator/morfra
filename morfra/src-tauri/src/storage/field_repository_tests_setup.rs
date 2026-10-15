use std::collections::HashMap;

use rusqlite::Connection;
use serde_json::json;

use crate::storage::connection::ProjectManifest;
use crate::storage::domain::TableDataSnapshot;
use crate::storage::field_repository;
use crate::storage::lifecycle;
use crate::storage::migrations;
use crate::storage::record_repository;
use crate::storage::repository;

fn setup() -> (Connection, String) {
    let mut connection = Connection::open_in_memory().expect("database");
    migrations::configure_connection(&connection).expect("configure");
    migrations::apply_pending_migrations(&mut connection, None).expect("migrate");
    let manifest = ProjectManifest {
        id: "phase35-project".into(),
        name: "Phase 35".into(),
        format_version: 1,
        created_at: "1".into(),
        updated_at: "1".into(),
    };
    let snapshot =
        repository::initialize_blank_project(&mut connection, &manifest).expect("project");
    (connection, snapshot.tables[0].id.clone())
}

fn data(connection: &Connection, table_id: &str) -> TableDataSnapshot {
    field_repository::load_table_data(connection, table_id).expect("table data")
}

fn title_id(connection: &Connection, table_id: &str) -> String {
    data(connection, table_id)
        .fields
        .into_iter()
        .find(|field| field.is_title)
        .expect("title field")
        .id
}



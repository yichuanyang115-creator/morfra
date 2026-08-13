use rusqlite::{Connection, OptionalExtension, Transaction};

use super::connection::timestamp;
use super::error::{StorageError, StorageErrorCode};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeletedTable {
    table: TableRow,
    project_updated_at: String,
    delete_updated_at: String,
    table_config_json: String,
    table_config_updated_at: String,
    fields: Vec<FieldRow>,
    options: Vec<FieldOptionRow>,
    views: Vec<ViewRow>,
    configs: Vec<ViewConfigRow>,
    records: Vec<RecordRow>,
    values: Vec<CellValueRow>,
    multi_values: Vec<MultiSelectValueRow>,
    attachments: Vec<AttachmentRow>,
}

impl DeletedTable {
    pub fn table_id(&self) -> &str {
        &self.table.id
    }

    pub fn project_updated_at(&self) -> &str {
        &self.project_updated_at
    }

    pub fn delete_updated_at(&self) -> &str {
        &self.delete_updated_at
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TableRow {
    id: String,
    project_id: String,
    name: String,
    icon: String,
    emoji: String,
    position: i64,
    created_at: String,
    updated_at: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
struct FieldRow {
    id: String,
    table_id: String,
    name: String,
    field_type: String,
    is_title: i64,
    position: i64,
    config_json: String,
    created_at: String,
    updated_at: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
struct FieldOptionRow {
    id: String,
    field_id: String,
    name: String,
    color: String,
    position: i64,
    created_at: String,
    updated_at: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
struct ViewRow {
    id: String,
    table_id: String,
    name: String,
    view_type: String,
    position: i64,
    created_at: String,
    updated_at: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
struct ViewConfigRow {
    view_id: String,
    version: i64,
    config_json: String,
    created_at: String,
    updated_at: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
struct RecordRow {
    id: String,
    table_id: String,
    position: i64,
    auto_number: i64,
    created_at: String,
    updated_at: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
struct MultiSelectValueRow {
    record_id: String,
    field_id: String,
    option_id: String,
    position: i64,
}
#[derive(Debug, Clone, PartialEq, Eq)]
struct CellValueRow {
    record_id: String,
    field_id: String,
    value_json: String,
    updated_at: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
struct AttachmentRow {
    id: String,
    record_id: String,
    field_id: String,
    relative_path: String,
    original_name: String,
    media_type: Option<String>,
    byte_size: i64,
    created_at: String,
}

include!("table_backup_mutations.rs");
include!("table_backup_capture.rs");

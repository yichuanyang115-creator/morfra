use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::Deserialize;
use serde_json::{json, Value};

use super::connection::timestamp;
use super::domain::{FieldSummary, RecordData};
use super::error::StorageError;
use super::field_models::{CellValueRow, FieldRow, MultiSelectValueRow};
use super::field_repository::load_fields;
use super::repository::new_id;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordBackup {
    pub record: RecordRow,
    values: Vec<CellValueRow>,
    multi_values: Vec<MultiSelectValueRow>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellUpdate {
    pub record_id: String,
    pub field_id: String,
    pub value: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewRecord {
    pub values: HashMap<String, Value>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BatchBackup {
    pub table_id: String,
    pub records: Vec<RecordBackup>,
    pub created_record_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct RecordRow {
    id: String,
    pub table_id: String,
    position: i64,
    auto_number: i64,
    created_at: String,
    updated_at: String,
}

include!("record_public.rs");
include!("record_read.rs");
include!("record_write.rs");

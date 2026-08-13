use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const FIELD_TYPES: &[&str] = &[
    "text",
    "select",
    "multi_select",
    "number",
    "progress",
    "date",
    "image",
    "file",
    "link",
    "checkbox",
    "auto_number",
    "created_time",
    "updated_time",
];

pub fn is_supported_field_type(field_type: &str) -> bool {
    FIELD_TYPES.contains(&field_type)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FieldOptionSummary {
    pub id: String,
    pub field_id: String,
    pub name: String,
    pub color: String,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FieldSummary {
    pub id: String,
    pub table_id: String,
    pub name: String,
    pub field_type: String,
    pub is_title: bool,
    pub position: i64,
    pub config: Value,
    pub options: Vec<FieldOptionSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecordData {
    pub id: String,
    pub table_id: String,
    pub position: i64,
    pub auto_number: i64,
    pub created_at: String,
    pub updated_at: String,
    pub values: HashMap<String, Value>,
    pub multi_select_values: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableDataSnapshot {
    pub table_id: String,
    pub table_name: String,
    pub title_field_id: String,
    pub fields: Vec<FieldSummary>,
    pub records: Vec<RecordData>,
    pub attachments: Vec<TableAttachmentMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TableAttachmentMetadata {
    pub id: String,
    pub record_id: String,
    pub field_id: String,
    pub original_name: String,
    pub media_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OptionUsage {
    pub record_count: i64,
    pub view_rule_count: i64,
}

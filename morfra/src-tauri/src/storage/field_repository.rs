use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde_json::{json, Value};

use super::activity_repository;
use super::connection::timestamp;
use super::domain::{FieldOptionSummary, FieldSummary, OptionUsage, TableDataSnapshot};
use super::error::StorageError;
use super::field_models::{
    CellValueRow, FieldBackup, FieldOptionRow, FieldRow,
    MultiSelectValueRow, OptionBackup, ViewConfigRow,
};
use super::record_repository;
use super::repository::new_id;

const DEFAULT_OPTION_COLORS: [&str; 8] = [
    "blue", "teal", "orange", "purple", "red", "yellow", "green", "gray",
];

include!("field_repository_data.rs");
include!("field_repository_options.rs");
include!("field_repository_backup.rs");
include!("field_repository_validation.rs");
include!("field_repository_cleanup.rs");
include!("field_repository_conversion.rs");

#[cfg(test)]
#[path = "field_repository_tests.rs"]
mod tests;

pub mod activity_repository;
pub mod attachments;
pub mod backup;
pub mod benchmark;
pub mod commands;
pub mod connection;
pub mod detail_content_repository;
pub mod domain;
pub mod error;
pub mod field_commands;
pub mod field_models;
pub mod field_repository;
pub mod lifecycle;
pub mod lifecycle_commands;
pub mod migrations;
pub mod record_commands;
pub mod record_repository;
pub mod repository;
pub mod table_backup;
pub mod undo;
pub mod validation;

use std::path::PathBuf;

use undo::UndoStack;

#[derive(Default)]
pub struct StorageState {
    pub active_project: Option<PathBuf>,
    pub undo: UndoStack,
}

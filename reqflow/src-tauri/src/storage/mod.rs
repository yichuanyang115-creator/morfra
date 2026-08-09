pub mod backup;
pub mod benchmark;
pub mod commands;
pub mod connection;
pub mod error;
pub mod lifecycle;
pub mod lifecycle_commands;
pub mod migrations;
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

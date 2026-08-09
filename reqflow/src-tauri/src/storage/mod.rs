pub mod backup;
pub mod benchmark;
pub mod commands;
pub mod connection;
pub mod error;
pub mod migrations;
pub mod repository;
pub mod undo;

use std::path::PathBuf;

use undo::UndoStack;

#[derive(Default)]
pub struct StorageState {
    pub active_project: Option<PathBuf>,
    pub undo: UndoStack,
}

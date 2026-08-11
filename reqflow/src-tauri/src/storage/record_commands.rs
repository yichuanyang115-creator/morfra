use std::collections::HashMap;
use std::sync::Mutex;

use serde_json::Value;
use tauri::State;

use super::commands::active_project_path;
use super::connection;
use super::domain::TableDataSnapshot;
use super::error::{StorageError, StorageErrorCode};
use super::field_repository;
use super::record_repository::{self, CellUpdate, NewRecord};
use super::undo::UndoAction;
use super::StorageState;

fn push_undo(state: &Mutex<StorageState>, action: UndoAction) -> Result<(), StorageError> {
    state
        .lock()
        .map_err(|_| {
            StorageError::new(StorageErrorCode::DatabaseError, "项目会话状态不可用", true)
        })?
        .undo
        .push(action);
    Ok(())
}

#[tauri::command]
pub fn storage_create_record(
    table_id: String,
    values: HashMap<String, Value>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let record_id = record_repository::create_record(&mut opened.connection, &table_id, values)?;
    push_undo(state.inner(), UndoAction::DeleteRecord { record_id })?;
    field_repository::load_table_data(&opened.connection, &table_id)
}

#[tauri::command]
pub fn storage_update_cell(
    record_id: String,
    field_id: String,
    value: Value,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let backup =
        record_repository::update_cell(&mut opened.connection, &record_id, &field_id, value)?;
    let table_id = backup.record.table_id.clone();
    push_undo(state.inner(), UndoAction::RestoreRecord { backup })?;
    field_repository::load_table_data(&opened.connection, &table_id)
}

#[tauri::command]
pub fn storage_delete_record(
    record_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let backup = record_repository::delete_record(&mut opened.connection, &record_id)?;
    let table_id = backup.record.table_id.clone();
    push_undo(state.inner(), UndoAction::RestoreRecord { backup })?;
    field_repository::load_table_data(&opened.connection, &table_id)
}

#[tauri::command]
pub fn storage_apply_table_mutation(
    table_id: String,
    updates: Vec<CellUpdate>,
    new_records: Vec<NewRecord>,
    delete_record_ids: Vec<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let backup = record_repository::apply_batch_mutation(
        &mut opened.connection,
        &table_id,
        updates,
        new_records,
        delete_record_ids,
    )?;
    push_undo(state.inner(), UndoAction::RestoreBatch { backup })?;
    field_repository::load_table_data(&opened.connection, &table_id)
}

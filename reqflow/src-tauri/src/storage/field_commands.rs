use std::sync::Mutex;

use serde_json::Value;
use tauri::State;

use super::commands::active_project_path;
use super::connection;
use super::domain::{OptionUsage, TableDataSnapshot};
use super::error::{StorageError, StorageErrorCode};
use super::field_repository;
use super::lifecycle;
use super::undo::UndoAction;
use super::StorageState;

fn table_data(path: &std::path::Path, table_id: &str) -> Result<TableDataSnapshot, StorageError> {
    let opened = connection::open_project(path)?;
    field_repository::load_table_data(&opened.connection, table_id)
}

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
pub fn storage_load_table_data(
    table_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    table_data(&path, &table_id)
}

#[tauri::command]
pub fn storage_create_field(
    table_id: String,
    name: String,
    field_type: String,
    config: Value,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let field_id = field_repository::create_field(
        &mut opened.connection,
        &table_id,
        &name,
        &field_type,
        config,
    )?;
    push_undo(state.inner(), UndoAction::DeleteField { field_id })?;
    table_data(&path, &table_id)
}

#[tauri::command]
pub fn storage_update_field(
    field_id: String,
    name: String,
    field_type: String,
    config: Value,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let backup = field_repository::update_field(
        &mut opened.connection,
        &field_id,
        &name,
        &field_type,
        config,
    )?;
    let table_id = backup.field.table_id.clone();
    push_undo(state.inner(), UndoAction::RestoreField { backup })?;
    table_data(&path, &table_id)
}

#[tauri::command]
pub fn storage_delete_field(
    field_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let backup = field_repository::delete_field(&mut opened.connection, &field_id)?;
    let table_id = backup.field.table_id.clone();
    push_undo(state.inner(), UndoAction::RestoreField { backup })?;
    table_data(&path, &table_id)
}

#[tauri::command]
pub fn storage_reorder_fields(
    table_id: String,
    field_ids: Vec<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::reorder_fields(&mut opened.connection, &table_id, &field_ids)?;
    table_data(&path, &table_id)
}

#[tauri::command]
pub fn storage_create_field_option(
    field_id: String,
    name: String,
    color: Option<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let option_id = field_repository::create_option(
        &mut opened.connection,
        &field_id,
        &name,
        color.as_deref(),
    )?;
    let table_id = field_table_id(&opened.connection, &field_id)?;
    push_undo(state.inner(), UndoAction::DeleteOption { option_id })?;
    table_data(&path, &table_id)
}

#[tauri::command]
pub fn storage_update_field_option(
    option_id: String,
    name: String,
    color: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let backup =
        field_repository::update_option(&mut opened.connection, &option_id, &name, &color)?;
    let table_id = field_table_id(&opened.connection, &backup.option.field_id)?;
    push_undo(state.inner(), UndoAction::RestoreOption { backup })?;
    table_data(&path, &table_id)
}

#[tauri::command]
pub fn storage_reorder_field_options(
    field_id: String,
    option_ids: Vec<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::reorder_field_options(&mut opened.connection, &field_id, &option_ids)?;
    let table_id = field_table_id(&opened.connection, &field_id)?;
    table_data(&path, &table_id)
}

#[tauri::command]
pub fn storage_get_field_option_usage(
    option_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<OptionUsage, StorageError> {
    let path = active_project_path(state.inner())?;
    let opened = connection::open_project(&path)?;
    field_repository::option_usage(&opened.connection, &option_id)
}

#[tauri::command]
pub fn storage_delete_field_option(
    option_id: String,
    mode: String,
    replacement_id: Option<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let backup = field_repository::delete_option(
        &mut opened.connection,
        &option_id,
        &mode,
        replacement_id.as_deref(),
    )?;
    let table_id = field_table_id(&opened.connection, &backup.option.field_id)?;
    push_undo(state.inner(), UndoAction::RestoreOption { backup })?;
    table_data(&path, &table_id)
}

fn field_table_id(
    connection: &rusqlite::Connection,
    field_id: &str,
) -> Result<String, StorageError> {
    connection
        .query_row(
            "SELECT table_id FROM fields WHERE id = ?1",
            [field_id],
            |row| row.get(0),
        )
        .map_err(StorageError::from)
}

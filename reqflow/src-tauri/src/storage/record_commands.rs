use std::collections::HashMap;
use std::sync::Mutex;

use serde_json::Value;
use tauri::State;

use super::activity_repository;
use super::commands::active_project_path;
use super::connection;
use super::detail_content_repository;
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

#[tauri::command]
pub fn storage_reorder_records(
    table_id: String,
    record_ids: Vec<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let backup =
        record_repository::reorder_records(&mut opened.connection, &table_id, &record_ids)?;
    push_undo(state.inner(), UndoAction::RestoreBatch { backup })?;
    field_repository::load_table_data(&opened.connection, &table_id)
}

#[tauri::command]
pub fn storage_move_board_card(
    view_id: String,
    record_id: String,
    field_id: String,
    value: Value,
    board_config: Value,
    state: State<'_, Mutex<StorageState>>,
) -> Result<TableDataSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let backup = record_repository::move_board_card(
        &mut opened.connection,
        &view_id,
        &record_id,
        &field_id,
        value,
        board_config,
    )?;
    let table_id = backup.record.record.table_id.clone();
    push_undo(state.inner(), UndoAction::RestoreBoardMove { backup })?;
    field_repository::load_table_data(&opened.connection, &table_id)
}

#[tauri::command]
pub fn storage_get_activity_binding(
    table_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<activity_repository::ActivityBinding, StorageError> {
    let path = active_project_path(state.inner())?;
    let opened = connection::open_project(&path)?;
    activity_repository::activity_binding(&opened.connection, &table_id)
}

#[tauri::command]
pub fn storage_update_activity_binding(
    table_id: String,
    field_id: Option<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<activity_repository::ActivityBinding, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let transaction = opened.connection.transaction()?;
    activity_repository::bind_activity_field(&transaction, &table_id, field_id.as_deref())?;
    transaction.execute(
        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
        [super::connection::timestamp()],
    )?;
    transaction.commit()?;
    activity_repository::activity_binding(&opened.connection, &table_id)
}

#[tauri::command]
pub fn storage_load_activity_events(
    record_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<Vec<activity_repository::ActivityEvent>, StorageError> {
    let path = active_project_path(state.inner())?;
    let opened = connection::open_project(&path)?;
    activity_repository::load_events(&opened.connection, &record_id)
}

#[tauri::command]
pub fn storage_update_activity_note(
    event_id: String,
    note: Option<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<(), StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    activity_repository::update_note(&mut opened.connection, &event_id, note.as_deref())
}

#[tauri::command]
pub fn storage_create_activity_comment(
    event_id: String,
    content: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<activity_repository::ActivityComment, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    activity_repository::create_comment(&mut opened.connection, &event_id, &content)
}

#[tauri::command]
pub fn storage_delete_activity_event(
    event_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<(), StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    activity_repository::delete_event(&mut opened.connection, &event_id)
}

#[tauri::command]
pub fn storage_get_detail_tabs(
    table_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<Vec<detail_content_repository::DetailTabDefinition>, StorageError> {
    let path = active_project_path(state.inner())?;
    let opened = connection::open_project(&path)?;
    detail_content_repository::load_detail_tabs(&opened.connection, &table_id)
}

#[tauri::command]
pub fn storage_load_record_detail_content(
    record_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<detail_content_repository::RecordDetailContent, StorageError> {
    let path = active_project_path(state.inner())?;
    let opened = connection::open_project(&path)?;
    detail_content_repository::load_record_detail_content(&opened.connection, &record_id)
}

#[tauri::command]
pub fn storage_save_record_detail_content(
    record_id: String,
    content: detail_content_repository::RecordDetailContentInput,
    state: State<'_, Mutex<StorageState>>,
) -> Result<detail_content_repository::RecordDetailContent, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    detail_content_repository::save_record_detail_content(
        &mut opened.connection,
        &record_id,
        content,
    )
}

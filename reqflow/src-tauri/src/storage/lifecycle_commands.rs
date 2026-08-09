use std::sync::Mutex;
use tauri::State;

use super::commands::active_project_path;
use super::connection::{self, ProjectManifest};
use super::error::StorageError;
use super::lifecycle;
use super::repository::{self, ProjectSnapshot};
use super::table_backup;
use super::undo::UndoAction;
use super::StorageState;

#[tauri::command]
pub fn storage_rename_project(
    name: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let previous = opened.manifest.clone();
    lifecycle::rename_project(&mut opened.connection, &name)?;
    let updated_at = connection::timestamp();
    let next = ProjectManifest {
        name: name.trim().to_string(),
        updated_at,
        ..previous.clone()
    };
    if let Err(error) =
        connection::write_manifest(&connection::ProjectPaths::existing(&path)?.manifest, &next)
    {
        let _ = lifecycle::rename_project(&mut opened.connection, &previous.name);
        return Err(error);
    }
    repository::load_snapshot(&opened.connection, &next)
}

#[tauri::command]
pub fn storage_rename_table(
    table_id: String,
    name: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::rename_table(&mut opened.connection, &table_id, &name)?;
    repository::load_snapshot(&opened.connection, &opened.manifest)
}

#[tauri::command]
pub fn storage_delete_table(
    table_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let deleted = table_backup::delete_table(&mut opened.connection, &table_id)?;
    let result = repository::load_snapshot(&opened.connection, &opened.manifest)?;
    state
        .lock()
        .map_err(|_| {
            super::error::StorageError::new(
                super::error::StorageErrorCode::DatabaseError,
                "项目会话状态不可用",
                true,
            )
        })?
        .undo
        .push(UndoAction::RestoreTable { table: deleted });
    Ok(result)
}

#[tauri::command]
pub fn storage_reorder_tables(
    table_ids: Vec<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::reorder_tables(&mut opened.connection, &table_ids)?;
    repository::load_snapshot(&opened.connection, &opened.manifest)
}

#[tauri::command]
pub fn storage_create_view(
    table_id: String,
    name: String,
    view_type: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::create_view(&mut opened.connection, &table_id, &name, &view_type)?;
    repository::load_snapshot(&opened.connection, &opened.manifest)
}

#[tauri::command]
pub fn storage_rename_view(
    view_id: String,
    name: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::rename_view(&mut opened.connection, &view_id, &name)?;
    repository::load_snapshot(&opened.connection, &opened.manifest)
}

#[tauri::command]
pub fn storage_duplicate_view(
    view_id: String,
    name: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::duplicate_view(&mut opened.connection, &view_id, &name)?;
    repository::load_snapshot(&opened.connection, &opened.manifest)
}

#[tauri::command]
pub fn storage_delete_view(
    view_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::delete_view(&mut opened.connection, &view_id)?;
    repository::load_snapshot(&opened.connection, &opened.manifest)
}

#[tauri::command]
pub fn storage_reorder_views(
    table_id: String,
    view_ids: Vec<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::reorder_views(&mut opened.connection, &table_id, &view_ids)?;
    repository::load_snapshot(&opened.connection, &opened.manifest)
}

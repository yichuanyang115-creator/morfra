use std::path::PathBuf;
use std::sync::Mutex;

use tauri::State;

use super::attachments::{self, Attachment};
use super::backup::{self, BackupInfo};
use super::benchmark::{self, BenchmarkReport};
use super::connection;
use super::error::{StorageError, StorageErrorCode};
use super::repository::{self, ProjectSnapshot};
use super::undo::UndoAction;
use super::StorageState;

pub(crate) fn active_project_path(state: &Mutex<StorageState>) -> Result<PathBuf, StorageError> {
    state
        .lock()
        .map_err(|_| {
            StorageError::new(StorageErrorCode::DatabaseError, "项目会话状态不可用", true)
        })?
        .active_project
        .clone()
        .ok_or_else(|| {
            StorageError::new(
                StorageErrorCode::ProjectNotFound,
                "当前没有打开的项目",
                false,
            )
        })
}

#[tauri::command]
pub fn storage_create_project(
    path: String,
    name: String,
    template: Option<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let root = PathBuf::from(&path);
    let snapshot = connection::create_project_with_template(&root, &name, template.as_deref())?;
    let mut session = state.lock().map_err(|_| {
        StorageError::new(StorageErrorCode::DatabaseError, "项目会话状态不可用", true)
    })?;
    session.active_project = Some(root);
    session.undo.clear();
    Ok(snapshot)
}

#[tauri::command]
pub fn storage_open_project(
    path: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let root = PathBuf::from(&path);
    let opened = connection::open_project(&root)?;
    let snapshot = repository::load_snapshot(&opened.connection, &opened.manifest)?;
    let mut session = state.lock().map_err(|_| {
        StorageError::new(StorageErrorCode::DatabaseError, "项目会话状态不可用", true)
    })?;
    session.active_project = Some(root);
    session.undo.clear();
    Ok(snapshot)
}

#[tauri::command]
pub fn storage_close_project(state: State<'_, Mutex<StorageState>>) -> Result<(), StorageError> {
    let path = active_project_path(state.inner())?;
    let paths = connection::ProjectPaths::existing(&path)?;
    let opened = connection::open_project(&path)?;
    attachments::cleanup_unreferenced(&paths, &opened.connection)?;
    let mut session = state.lock().map_err(|_| {
        StorageError::new(StorageErrorCode::DatabaseError, "项目会话状态不可用", true)
    })?;
    session.active_project = None;
    session.undo.clear();
    Ok(())
}

#[tauri::command]
pub fn storage_create_table(
    name: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    let table = repository::create_table(&mut opened.connection, &name)?;
    let snapshot = repository::load_snapshot(&opened.connection, &opened.manifest)?;
    let mut session = state.lock().map_err(|_| {
        StorageError::new(StorageErrorCode::DatabaseError, "项目会话状态不可用", true)
    })?;
    session
        .undo
        .push(UndoAction::DeleteTable { table_id: table.id });
    Ok(snapshot)
}

#[tauri::command]
pub fn storage_undo(
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    {
        let mut session = state.lock().map_err(|_| {
            StorageError::new(StorageErrorCode::DatabaseError, "项目会话状态不可用", true)
        })?;
        session.undo.undo(&mut opened.connection)?;
    }
    let snapshot = repository::load_snapshot(&opened.connection, &opened.manifest)?;
    Ok(snapshot)
}

#[tauri::command]
pub fn storage_run_benchmark() -> Result<BenchmarkReport, StorageError> {
    benchmark::run_in_memory()
}

#[tauri::command]
pub fn storage_backup_project(
    state: State<'_, Mutex<StorageState>>,
) -> Result<BackupInfo, StorageError> {
    let path = active_project_path(state.inner())?;
    let opened = connection::open_project(&path)?;
    let paths = connection::ProjectPaths::existing(&path)?;
    backup::create_manual_backup(&paths, &opened.manifest, &opened.connection)
}

#[tauri::command]
pub fn storage_list_backups(
    state: State<'_, Mutex<StorageState>>,
) -> Result<Vec<BackupInfo>, StorageError> {
    let path = active_project_path(state.inner())?;
    let paths = connection::ProjectPaths::existing(&path)?;
    backup::list_backups(&paths)
}

#[tauri::command]
pub fn storage_restore_project(
    backup_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let paths = connection::ProjectPaths::existing(&path)?;
    backup::restore_project(&paths, &backup_id)?;
    let opened = connection::open_project(&path)?;
    let snapshot = repository::load_snapshot(&opened.connection, &opened.manifest)?;
    state
        .lock()
        .map_err(|_| {
            StorageError::new(StorageErrorCode::DatabaseError, "项目会话状态不可用", true)
        })?
        .undo
        .clear();
    Ok(snapshot)
}

#[tauri::command]
pub fn storage_add_attachment(
    record_id: String,
    field_id: String,
    source_path: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<Attachment, StorageError> {
    let path = active_project_path(state.inner())?;
    let paths = connection::ProjectPaths::existing(&path)?;
    let mut opened = connection::open_project(&path)?;
    attachments::add_file(
        &paths,
        &mut opened.connection,
        &record_id,
        &field_id,
        &PathBuf::from(source_path),
    )
}

#[tauri::command]
pub fn storage_list_attachments(
    record_id: String,
    field_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<Vec<Attachment>, StorageError> {
    let path = active_project_path(state.inner())?;
    let opened = connection::open_project(&path)?;
    attachments::list_for_cell(&opened.connection, &record_id, &field_id)
}

#[tauri::command]
pub fn storage_remove_attachment(
    attachment_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<(), StorageError> {
    let path = active_project_path(state.inner())?;
    let paths = connection::ProjectPaths::existing(&path)?;
    let mut opened = connection::open_project(&path)?;
    attachments::remove_file(&paths, &mut opened.connection, &attachment_id)
}

#[tauri::command]
pub fn storage_replace_attachment(
    attachment_id: String,
    source_path: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<Attachment, StorageError> {
    let path = active_project_path(state.inner())?;
    let paths = connection::ProjectPaths::existing(&path)?;
    let mut opened = connection::open_project(&path)?;
    attachments::replace_file(
        &paths,
        &mut opened.connection,
        &attachment_id,
        &PathBuf::from(source_path),
    )
}

#[tauri::command]
pub fn storage_attachment_path(
    attachment_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<String, StorageError> {
    let path = active_project_path(state.inner())?;
    let paths = connection::ProjectPaths::existing(&path)?;
    let opened = connection::open_project(&path)?;
    attachments::resolve_path(&paths, &attachment_id, &opened.connection)
        .map(|path| path.to_string_lossy().into_owned())
}

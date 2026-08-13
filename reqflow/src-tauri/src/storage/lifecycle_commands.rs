use serde_json::Value;
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

fn delete_table_atomically(
    connection: &mut rusqlite::Connection,
    manifest: &ProjectManifest,
    table_id: &str,
) -> Result<(ProjectSnapshot, table_backup::DeletedTable), StorageError> {
    let previous_updated_at: String = connection.query_row(
        "SELECT updated_at FROM project_meta WHERE id = 'project'",
        [],
        |row| row.get(0),
    )?;
    let deleted = table_backup::delete_table(connection, table_id)?;
    match repository::load_snapshot(connection, manifest) {
        Ok(snapshot) => Ok((snapshot, deleted)),
        Err(error) => {
            // The delete transaction has already committed. Restore the exact
            // captured table before returning an error so the JS lifecycle can
            // safely roll back its staged AI directory without orphaning it.
            table_backup::restore_table(connection, &deleted)?;
            connection.execute(
                "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
                [&previous_updated_at],
            )?;
            Err(error)
        }
    }
}

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
pub fn storage_update_table_emoji(
    table_id: String,
    emoji: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::update_table_emoji(&mut opened.connection, &table_id, &emoji)?;
    repository::load_snapshot(&opened.connection, &opened.manifest)
}

#[tauri::command]
pub fn storage_delete_table(
    table_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    // Acquire the session guard before the irreversible database operation. If
    // the mutex is poisoned, the command must fail while both the table and its
    // staged AI data are still intact.
    let mut session = state.lock().map_err(|_| {
        super::error::StorageError::new(
            super::error::StorageErrorCode::DatabaseError,
            "项目会话状态不可用",
            true,
        )
    })?;
    let path = session.active_project.clone().ok_or_else(|| {
        super::error::StorageError::new(
            super::error::StorageErrorCode::ProjectNotFound,
            "当前没有打开的项目",
            false,
        )
    })?;
    let mut opened = connection::open_project(&path)?;
    let (result, deleted) =
        delete_table_atomically(&mut opened.connection, &opened.manifest, &table_id)?;
    session
        .undo
        .push(UndoAction::RestoreTable { table: deleted });
    Ok(result)
}

#[tauri::command]
pub fn storage_restore_deleted_table(
    table_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<ProjectSnapshot, StorageError> {
    let mut session = state.lock().map_err(|_| {
        super::error::StorageError::new(
            super::error::StorageErrorCode::DatabaseError,
            "项目会话状态不可用",
            true,
        )
    })?;
    let path = session.active_project.clone().ok_or_else(|| {
        super::error::StorageError::new(
            super::error::StorageErrorCode::ProjectNotFound,
            "当前没有打开的项目",
            false,
        )
    })?;
    let mut opened = connection::open_project(&path)?;
    session
        .undo
        .restore_deleted_table(&mut opened.connection, &table_id)?;
    repository::load_snapshot(&opened.connection, &opened.manifest)
}

#[cfg(test)]
mod tests {
    use super::delete_table_atomically;
    use crate::storage::connection::ProjectManifest;
    use crate::storage::migrations::{apply_pending_migrations, configure_connection};
    use crate::storage::repository::{create_table, initialize_blank_project, load_snapshot};

    fn database() -> (rusqlite::Connection, ProjectManifest) {
        let mut connection = rusqlite::Connection::open_in_memory().expect("database");
        configure_connection(&connection).expect("configure");
        apply_pending_migrations(&mut connection, None).expect("migrate");
        let manifest = ProjectManifest {
            id: "project".into(),
            name: "测试项目".into(),
            format_version: 1,
            created_at: "1".into(),
            updated_at: "1".into(),
        };
        initialize_blank_project(&mut connection, &manifest).expect("blank project");
        (connection, manifest)
    }

    #[test]
    fn failed_post_delete_snapshot_restores_table_before_returning_error() {
        let (mut connection, manifest) = database();
        let created = create_table(&mut connection, "待删除表").expect("table");
        let invalid_manifest = ProjectManifest {
            id: "missing-project".into(),
            ..manifest.clone()
        };
        let before = load_snapshot(&connection, &manifest).expect("before");
        let before_updated_at: String = connection
            .query_row(
                "SELECT updated_at FROM project_meta WHERE id = 'project'",
                [],
                |row| row.get(0),
            )
            .expect("updated_at");

        let result = delete_table_atomically(&mut connection, &invalid_manifest, &created.id);

        assert!(result.is_err());
        let snapshot = load_snapshot(&connection, &manifest).expect("restored snapshot");
        assert_eq!(snapshot.tables, before.tables);
        let restored_updated_at: String = connection
            .query_row(
                "SELECT updated_at FROM project_meta WHERE id = 'project'",
                [],
                |row| row.get(0),
            )
            .expect("restored updated_at");
        assert_eq!(restored_updated_at, before_updated_at);
    }
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

#[tauri::command]
pub fn storage_get_view_config(
    view_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<Value, StorageError> {
    let path = active_project_path(state.inner())?;
    let opened = connection::open_project(&path)?;
    lifecycle::load_view_config(&opened.connection, &view_id)
}

#[tauri::command]
pub fn storage_update_view_config(
    view_id: String,
    config: Value,
    state: State<'_, Mutex<StorageState>>,
) -> Result<Value, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::update_view_config(&mut opened.connection, &view_id, config)
}

#[tauri::command]
pub fn storage_get_detail_fields(
    table_id: String,
    state: State<'_, Mutex<StorageState>>,
) -> Result<Vec<String>, StorageError> {
    let path = active_project_path(state.inner())?;
    let opened = connection::open_project(&path)?;
    lifecycle::load_detail_fields(&opened.connection, &table_id)
}

#[tauri::command]
pub fn storage_update_detail_fields(
    table_id: String,
    field_ids: Vec<String>,
    state: State<'_, Mutex<StorageState>>,
) -> Result<Vec<String>, StorageError> {
    let path = active_project_path(state.inner())?;
    let mut opened = connection::open_project(&path)?;
    lifecycle::update_detail_fields(&mut opened.connection, &table_id, &field_ids)
}

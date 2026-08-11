use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::{backup::Backup, Connection};
use serde::{Deserialize, Serialize};

use super::connection::{
    read_manifest, timestamp, ProjectManifest, ProjectPaths, ATTACHMENTS_DIRECTORY, DATABASE_FILE, PROJECT_MANIFEST_FILE,
};
use super::error::{StorageError, StorageErrorCode};
use super::{migrations, repository};

const MAX_BACKUPS: usize = 7;
static BACKUP_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub id: String,
    pub created_at: String,
}

pub fn ensure_daily_backup(
    paths: &ProjectPaths,
    manifest: &ProjectManifest,
    source: &Connection,
) -> Result<(), StorageError> {
    let id = format!("backup-daily-{}", day_number());
    let directory = backup_directory(paths, &id)?;
    if directory.exists() {
        backup_info_from_directory(&directory)?;
    } else {
        create_backup_with_id(paths, manifest, source, &id)?;
        retain_latest(paths)?;
    }
    Ok(())
}

pub fn create_manual_backup(
    paths: &ProjectPaths,
    manifest: &ProjectManifest,
    source: &Connection,
) -> Result<BackupInfo, StorageError> {
    let sequence = BACKUP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let id = format!("backup-manual-{}-{sequence}", timestamp());
    let info = create_backup_with_id(paths, manifest, source, &id)?;
    retain_latest(paths)?;
    Ok(info)
}

pub fn list_backups(paths: &ProjectPaths) -> Result<Vec<BackupInfo>, StorageError> {
    if !paths.backups.is_dir() {
        return Ok(Vec::new());
    }
    let mut backups = fs::read_dir(&paths.backups)?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| backup_info_from_directory(&entry.path()).ok())
        .collect::<Vec<_>>();
    backups.sort_by(|left, right| right.id.cmp(&left.id));
    Ok(backups)
}

pub fn restore_project(paths: &ProjectPaths, backup_id: &str) -> Result<(), StorageError> {
    let backup_path = backup_directory(paths, backup_id)?;
    let backup_manifest_path = backup_path.join(PROJECT_MANIFEST_FILE);
    let backup_database_path = backup_path.join(DATABASE_FILE);
    let backup_attachments_path = backup_path.join(ATTACHMENTS_DIRECTORY);
    let backup_manifest = read_manifest(&backup_manifest_path)?;
    super::connection::validate_manifest(&backup_manifest)?;
    verify_backup(&backup_database_path, &backup_manifest)?;
    if !backup_attachments_path.is_dir() { return Err(StorageError::new(StorageErrorCode::InvalidProjectManifest, "备份附件目录不完整，已取消恢复", false)); }

    let current_manifest = read_manifest(&paths.manifest)?;
    let current_connection = Connection::open(&paths.database)?;
    migrations::configure_connection(&current_connection)?;
    let sequence = BACKUP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let pre_restore_id = format!("backup-manual-{}-{sequence}", timestamp());
    create_backup_with_id(
        paths,
        &current_manifest,
        &current_connection,
        &pre_restore_id,
    )?;
    drop(current_connection);

    let temporary_database = paths.root.join("morfra.restore.sqlite3.tmp");
    let temporary_manifest = paths.root.join("project.json.restore.tmp");
    let temporary_attachments = paths.root.join("attachments.restore.tmp");
    let previous_database = paths.root.join("morfra.sqlite3.restore.previous");
    let previous_manifest = paths.root.join("project.json.restore.previous");
    let previous_attachments = paths.root.join("attachments.restore.previous");
    let _ = fs::remove_file(&temporary_database);
    let _ = fs::remove_file(&temporary_manifest);
    let _ = fs::remove_dir_all(&temporary_attachments);
    let _ = fs::remove_file(&previous_database);
    let _ = fs::remove_file(&previous_manifest);
    let _ = fs::remove_dir_all(&previous_attachments);
    let restore_result = (|| {
        restore_database(&backup_database_path, &temporary_database)?;
        fs::copy(&backup_manifest_path, &temporary_manifest)?;
        copy_directory(&backup_attachments_path, &temporary_attachments)?;
        fs::rename(&paths.database, &previous_database)?;
        fs::rename(&paths.manifest, &previous_manifest)?;
        fs::rename(&paths.attachments, &previous_attachments)?;
        fs::rename(&temporary_database, &paths.database)?;
        fs::rename(&temporary_manifest, &paths.manifest)?;
        fs::rename(&temporary_attachments, &paths.attachments)?;
        verify_backup(&paths.database, &backup_manifest)?;
        Ok::<(), StorageError>(())
    })();
    if let Err(error) = restore_result {
        let rollback_database = paths.root.join("morfra.rollback.sqlite3.tmp");
        let rollback_manifest = paths.root.join("project.json.rollback.tmp");
        let pre_restore_path = backup_directory(paths, &pre_restore_id)?;
        let rollback_result = (|| {
            let _ = fs::remove_file(&rollback_database);
            let _ = fs::remove_file(&rollback_manifest);
            restore_database(&pre_restore_path.join(DATABASE_FILE), &rollback_database)?;
            fs::copy(
                pre_restore_path.join(PROJECT_MANIFEST_FILE),
                &rollback_manifest,
            )?;
            let _ = fs::remove_file(&paths.database);
            let _ = fs::remove_file(&paths.manifest);
            let _ = fs::remove_dir_all(&paths.attachments);
            if previous_database.exists() { fs::rename(&previous_database, &paths.database)?; } else { fs::rename(rollback_database, &paths.database)?; }
            if previous_manifest.exists() { fs::rename(&previous_manifest, &paths.manifest)?; } else { fs::rename(rollback_manifest, &paths.manifest)?; }
            if previous_attachments.exists() { fs::rename(&previous_attachments, &paths.attachments)?; } else { copy_directory(&pre_restore_path.join(ATTACHMENTS_DIRECTORY), &paths.attachments)?; }
            Ok::<(), StorageError>(())
        })();
        let _ = fs::remove_file(&temporary_database);
        let _ = fs::remove_file(&temporary_manifest);
        let _ = fs::remove_dir_all(&temporary_attachments);
        if rollback_result.is_err() {
            return Err(StorageError::new(
                StorageErrorCode::IoError,
                "恢复失败且无法自动回滚，请使用最近一次备份恢复",
                false,
            ));
        }
        return Err(error);
    }
    let _ = fs::remove_file(previous_database);
    let _ = fs::remove_file(previous_manifest);
    let _ = fs::remove_dir_all(previous_attachments);
    retain_latest(paths)?;
    Ok(())
}

fn create_backup_with_id(
    paths: &ProjectPaths,
    manifest: &ProjectManifest,
    source: &Connection,
    id: &str,
) -> Result<BackupInfo, StorageError> {
    let directory = backup_directory(paths, id)?;
    if directory.exists() {
        return backup_info_from_directory(&directory);
    }
    fs::create_dir_all(&directory)?;
    let database_path = directory.join(DATABASE_FILE);
    let result = (|| {
        let mut destination = Connection::open(&database_path)?;
        let backup = Backup::new(source, &mut destination)
            .map_err(|_| StorageError::new(StorageErrorCode::IoError, "创建项目备份失败", true))?;
        backup
            .run_to_completion(100, Duration::from_millis(1), None)
            .map_err(|_| StorageError::new(StorageErrorCode::IoError, "创建项目备份失败", true))?;
        fs::write(
            directory.join(PROJECT_MANIFEST_FILE),
            serde_json::to_vec_pretty(manifest)?,
        )?;
        copy_directory(&paths.attachments, &directory.join(ATTACHMENTS_DIRECTORY))?;
        Ok::<(), StorageError>(())
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(&directory);
    }
    result?;
    Ok(BackupInfo {
        id: id.to_string(),
        created_at: manifest.updated_at.clone(),
    })
}

fn verify_backup(database_path: &Path, manifest: &ProjectManifest) -> Result<(), StorageError> {
    let connection = Connection::open(database_path)?;
    migrations::configure_connection(&connection)?;
    let integrity: String = connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity != "ok" {
        return Err(StorageError::new(
            StorageErrorCode::InvalidProjectManifest,
            "备份数据库完整性校验失败，已取消恢复",
            false,
        ));
    }
    repository::validate_project_identity(&connection, manifest)
}

fn restore_database(source_path: &Path, destination_path: &Path) -> Result<(), StorageError> {
    let source = Connection::open(source_path)?;
    let mut destination = Connection::open(destination_path)?;
    let backup = Backup::new(&source, &mut destination)
        .map_err(|_| StorageError::new(StorageErrorCode::IoError, "恢复项目数据库失败", false))?;
    backup
        .run_to_completion(100, Duration::from_millis(1), None)
        .map_err(|_| StorageError::new(StorageErrorCode::IoError, "恢复项目数据库失败", false))?;
    Ok(())
}

pub(crate) fn retain_latest(paths: &ProjectPaths) -> Result<(), StorageError> {
    let mut directories = fs::read_dir(&paths.backups)?
        .filter_map(Result::ok)
        .map(|entry| {
            let path = entry.path();
            let modified = entry.metadata().ok().and_then(|metadata| metadata.modified().ok()).unwrap_or(SystemTime::UNIX_EPOCH);
            (path, modified)
        })
        .filter(|path| {
            path.0.is_dir()
                && path.0
                    .file_name()
                    .is_some_and(|name| name.to_string_lossy().starts_with("backup-"))
        })
        .collect::<Vec<_>>();
    directories.sort_by(|left, right| right.1.cmp(&left.1));
    let remove_count = directories.len().saturating_sub(MAX_BACKUPS);
    for (directory, _) in directories.into_iter().skip(MAX_BACKUPS).take(remove_count) {
        fs::remove_dir_all(directory)?;
    }
    Ok(())
}

fn backup_info_from_directory(directory: &Path) -> Result<BackupInfo, StorageError> {
    let id = directory
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| StorageError::validation("备份标识无效"))?;
    let manifest = read_manifest(&directory.join(PROJECT_MANIFEST_FILE))?;
    Ok(BackupInfo {
        id: id.to_string(),
        created_at: manifest.updated_at,
    })
}

fn backup_directory(paths: &ProjectPaths, backup_id: &str) -> Result<PathBuf, StorageError> {
    if backup_id.len() > 120
        || !backup_id.starts_with("backup-")
        || backup_id.contains('/')
        || backup_id.contains('\\')
        || backup_id.contains('\0')
    {
        return Err(StorageError::validation("备份标识无效"));
    }
    Ok(paths.backups.join(backup_id))
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), StorageError> {
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let target = destination.join(entry.file_name());
        if entry.file_type()?.is_dir() { copy_directory(&entry.path(), &target)?; } else if entry.file_type()?.is_file() { fs::copy(entry.path(), target)?; }
    }
    Ok(())
}

fn day_number() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        / 86_400
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{create_manual_backup, ensure_daily_backup, list_backups, restore_project};
    use crate::storage::connection::{create_project, open_project, ProjectPaths, DATABASE_FILE};
    use crate::storage::repository;

    fn project_root(label: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("morfra-backup-{label}-{}", std::process::id()))
    }

    #[test]
    fn creates_daily_and_manual_backups_and_retains_latest_seven() {
        let root = project_root("retention");
        let _ = fs::remove_dir_all(&root);
        create_project(&root, "备份测试").expect("create");
        let opened = open_project(&root).expect("open");
        let paths = ProjectPaths::existing(&root).expect("paths");
        for _ in 0..8 {
            create_manual_backup(&paths, &opened.manifest, &opened.connection).expect("backup");
        }
        assert_eq!(list_backups(&paths).expect("list").len(), 7);
        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn only_creates_one_daily_backup_per_open_day() {
        let root = project_root("daily"); let _ = fs::remove_dir_all(&root); create_project(&root, "备份测试").expect("create");
        let opened = open_project(&root).expect("open"); let paths = ProjectPaths::existing(&root).expect("paths");
        ensure_daily_backup(&paths, &opened.manifest, &opened.connection).expect("daily backup");
        ensure_daily_backup(&paths, &opened.manifest, &opened.connection).expect("same day no duplicate");
        assert_eq!(list_backups(&paths).expect("list").iter().filter(|backup| backup.id.starts_with("backup-daily-")).count(), 1);
        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn restore_reverts_database_and_manifest_from_backup() {
        let root = project_root("restore");
        let _ = fs::remove_dir_all(&root);
        create_project(&root, "恢复测试").expect("create");
        let opened = open_project(&root).expect("open");
        let paths = ProjectPaths::existing(&root).expect("paths");
        let stable_backup =
            create_manual_backup(&paths, &opened.manifest, &opened.connection).expect("backup");
        let mut connection = opened.connection;
        let table = repository::create_table(&mut connection, "临时表").expect("table");
        assert_eq!(table.name, "临时表");
        drop(connection);
        restore_project(&paths, &stable_backup.id).expect("restore");
        let reopened = open_project(&root).expect("reopen");
        let snapshot =
            repository::load_snapshot(&reopened.connection, &reopened.manifest).expect("snapshot");
        assert_eq!(snapshot.tables.len(), 1);
        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn corrupt_backup_never_replaces_the_current_project() {
        let root = project_root("corrupt"); let _ = fs::remove_dir_all(&root);
        create_project(&root, "恢复测试").expect("create");
        let opened = open_project(&root).expect("open"); let paths = ProjectPaths::existing(&root).expect("paths");
        let stable = create_manual_backup(&paths, &opened.manifest, &opened.connection).expect("backup");
        fs::write(paths.backups.join(&stable.id).join(DATABASE_FILE), "not sqlite").expect("corrupt");
        assert!(restore_project(&paths, &stable.id).is_err());
        assert!(open_project(&root).is_ok());
        fs::remove_dir_all(root).expect("cleanup");
    }
}

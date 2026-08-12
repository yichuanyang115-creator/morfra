use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use super::backup;
use super::error::{StorageError, StorageErrorCode};
use super::{migrations, repository, validation};

pub const PROJECT_MANIFEST_FILE: &str = "project.json";
pub const DATABASE_FILE: &str = "morfra.sqlite3";
pub const ATTACHMENTS_DIRECTORY: &str = "attachments";
pub const BACKUPS_DIRECTORY: &str = "backups";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectManifest {
    pub id: String,
    pub name: String,
    pub format_version: u32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct ProjectPaths {
    pub root: PathBuf,
    pub manifest: PathBuf,
    pub database: PathBuf,
    pub attachments: PathBuf,
    pub backups: PathBuf,
}

impl ProjectPaths {
    pub fn new(root: impl Into<PathBuf>) -> Result<Self, StorageError> {
        let root = root.into();
        if !root.is_absolute() || root.parent().is_none() || root.file_name().is_none() {
            return Err(StorageError::new(
                StorageErrorCode::InvalidProjectPath,
                "项目路径必须是有效的本地文件夹",
                false,
            ));
        }
        Ok(Self {
            manifest: root.join(PROJECT_MANIFEST_FILE),
            database: root.join(DATABASE_FILE),
            attachments: root.join(ATTACHMENTS_DIRECTORY),
            backups: root.join(BACKUPS_DIRECTORY),
            root,
        })
    }

    pub fn existing(root: impl Into<PathBuf>) -> Result<Self, StorageError> {
        let paths = Self::new(root)?;
        if !paths.root.is_dir() {
            return Err(StorageError::not_found("项目文件夹不存在"));
        }
        if !paths.manifest.is_file() || !paths.database.is_file() {
            return Err(StorageError::new(
                StorageErrorCode::InvalidProjectManifest,
                "项目文件夹缺少有效的 Morfra 项目文件",
                false,
            ));
        }
        Ok(paths)
    }

    pub(crate) fn initialize_directories(&self) -> Result<(), StorageError> {
        fs::create_dir_all(&self.root)?;
        fs::create_dir_all(&self.attachments)?;
        fs::create_dir_all(&self.backups)?;
        Ok(())
    }
}

pub struct OpenProject {
    pub manifest: ProjectManifest,
    pub connection: Connection,
}

#[cfg(test)]
pub fn create_project(
    root: &Path,
    name: &str,
) -> Result<repository::ProjectSnapshot, StorageError> {
    create_project_with_template(root, name, None)
}

pub fn create_project_with_template(
    root: &Path,
    name: &str,
    template: Option<&str>,
) -> Result<repository::ProjectSnapshot, StorageError> {
    let paths = ProjectPaths::new(root.to_path_buf())?;
    validate_project_name(name)?;
    let root_was_new = !paths.root.exists();
    if paths.root.exists() && fs::read_dir(&paths.root)?.next().is_some() {
        return Err(StorageError::new(
            StorageErrorCode::ProjectAlreadyExists,
            "目标文件夹不是空文件夹，无法创建 Morfra 项目",
            false,
        ));
    }

    let result = (|| {
        paths.initialize_directories()?;
        let manifest = new_manifest(name.trim());
        write_manifest(&paths.manifest, &manifest)?;
        let mut connection = open_connection(&paths)?;
        let snapshot = repository::initialize_blank_project(&mut connection, &manifest)?;
        if template == Some("requirements") {
            repository::apply_requirement_template(
                &mut connection,
                &manifest,
                &snapshot.tables[0].id,
            )
        } else {
            Ok(snapshot)
        }
    })();
    if result.is_err() {
        cleanup_failed_creation(&paths, root_was_new);
    }
    result
}

fn cleanup_failed_creation(paths: &ProjectPaths, remove_root: bool) {
    for path in [
        &paths.manifest,
        &paths.database,
        &paths.root.join("morfra.sqlite3-shm"),
        &paths.root.join("morfra.sqlite3-wal"),
        &paths.root.join("project.json.tmp"),
    ] {
        let _ = fs::remove_file(path);
    }
    let _ = fs::remove_dir_all(&paths.attachments);
    let _ = fs::remove_dir_all(&paths.backups);
    if remove_root {
        let _ = fs::remove_dir_all(&paths.root);
    }
}

pub fn open_project(root: &Path) -> Result<OpenProject, StorageError> {
    let paths = ProjectPaths::existing(root.to_path_buf())?;
    paths.initialize_directories()?;
    let manifest = read_manifest(&paths.manifest)?;
    validate_manifest(&manifest)?;
    let connection = open_connection(&paths)?;
    repository::validate_project_identity(&connection, &manifest)?;
    validation::validate_project_structure(&connection)?;
    backup::ensure_daily_backup(&paths, &manifest, &connection)?;
    Ok(OpenProject {
        manifest,
        connection,
    })
}

fn open_connection(paths: &ProjectPaths) -> Result<Connection, StorageError> {
    let mut connection = Connection::open(&paths.database)?;
    migrations::configure_connection(&connection)?;
    migrations::apply_pending_migrations(&mut connection, Some(&paths.backups))?;
    Ok(connection)
}

pub(crate) fn write_manifest(path: &Path, manifest: &ProjectManifest) -> Result<(), StorageError> {
    let temporary_path = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(manifest)?;
    fs::write(&temporary_path, bytes)?;
    fs::rename(temporary_path, path)?;
    Ok(())
}

pub(crate) fn read_manifest(path: &Path) -> Result<ProjectManifest, StorageError> {
    let bytes = fs::read(path)?;
    Ok(serde_json::from_slice(&bytes)?)
}

fn new_manifest(name: &str) -> ProjectManifest {
    let timestamp = timestamp();
    ProjectManifest {
        id: repository::new_id("project"),
        name: name.to_string(),
        format_version: 1,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    }
}

pub(crate) fn validate_manifest(manifest: &ProjectManifest) -> Result<(), StorageError> {
    if manifest.id.trim().is_empty() || manifest.format_version != 1 {
        return Err(StorageError::new(
            StorageErrorCode::InvalidProjectManifest,
            "项目格式版本不受支持",
            false,
        ));
    }
    validate_project_name(&manifest.name)
}

fn validate_project_name(name: &str) -> Result<(), StorageError> {
    if name.trim().is_empty() || name.chars().count() > 200 {
        return Err(StorageError::validation(
            "项目名称不能为空且不能超过 200 个字符",
        ));
    }
    Ok(())
}

pub(crate) fn timestamp() -> String {
    let milliseconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    milliseconds.to_string()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{cleanup_failed_creation, create_project, open_project, ProjectPaths};
    use crate::storage::repository::load_snapshot;

    fn temporary_path(label: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("morfra-phase32-{label}-{}", std::process::id()))
    }

    #[test]
    fn creates_and_reopens_blank_project_with_required_package() {
        let root = temporary_path("create-open");
        let _ = fs::remove_dir_all(&root);
        let created = create_project(&root, "测试项目").expect("create");
        let reopened = open_project(&root).expect("open");
        let reopened_snapshot =
            load_snapshot(&reopened.connection, &reopened.manifest).expect("snapshot");
        assert_eq!(created.manifest, reopened_snapshot.manifest);
        assert_eq!(reopened_snapshot.tables.len(), 1);
        assert_eq!(reopened_snapshot.tables[0].views.len(), 1);
        assert!(ProjectPaths::existing(&root)
            .expect("paths")
            .manifest
            .is_file());
        assert!(ProjectPaths::existing(&root)
            .expect("paths")
            .database
            .is_file());
        assert!(ProjectPaths::existing(&root)
            .expect("paths")
            .attachments
            .is_dir());
        assert!(ProjectPaths::existing(&root)
            .expect("paths")
            .backups
            .is_dir());
        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn failed_creation_cleanup_removes_generated_package_artifacts() {
        let root = temporary_path("cleanup");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("root");
        let paths = ProjectPaths::new(&root).expect("paths");
        paths.initialize_directories().expect("directories");
        fs::write(&paths.manifest, "partial").expect("manifest");
        fs::write(&paths.database, "partial").expect("database");
        fs::write(root.join("morfra.sqlite3-wal"), "partial").expect("wal");

        cleanup_failed_creation(&paths, false);

        assert!(root.is_dir());
        assert!(!paths.manifest.exists());
        assert!(!paths.database.exists());
        assert!(!paths.attachments.exists());
        assert!(!paths.backups.exists());
        fs::remove_dir_all(root).expect("cleanup");
    }
}

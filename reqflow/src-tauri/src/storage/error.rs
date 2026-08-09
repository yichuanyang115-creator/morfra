use rusqlite::Error as SqliteError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StorageErrorCode {
    InvalidProjectPath,
    ProjectAlreadyExists,
    ProjectNotFound,
    InvalidProjectManifest,
    DatabaseCorrupt,
    MigrationFailed,
    DatabaseError,
    IoError,
    ValidationError,
    UndoUnavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StorageError {
    pub code: StorageErrorCode,
    pub message: String,
    pub retryable: bool,
}

impl StorageError {
    pub fn new(code: StorageErrorCode, message: &str, retryable: bool) -> Self {
        Self {
            code,
            message: message.to_string(),
            retryable,
        }
    }

    pub fn validation(message: &str) -> Self {
        Self::new(StorageErrorCode::ValidationError, message, false)
    }

    pub fn not_found(message: &str) -> Self {
        Self::new(StorageErrorCode::ProjectNotFound, message, false)
    }
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for StorageError {}

impl From<std::io::Error> for StorageError {
    fn from(_: std::io::Error) -> Self {
        Self::new(
            StorageErrorCode::IoError,
            "项目文件操作失败，请检查文件夹权限",
            true,
        )
    }
}

impl From<serde_json::Error> for StorageError {
    fn from(_: serde_json::Error) -> Self {
        Self::new(
            StorageErrorCode::InvalidProjectManifest,
            "项目元信息无法解析，请选择有效的 Morfra 项目文件夹",
            false,
        )
    }
}

impl From<SqliteError> for StorageError {
    fn from(error: SqliteError) -> Self {
        let retryable = matches!(
            error,
            SqliteError::SqliteFailure(ref failure, _)
                if failure.code == rusqlite::ErrorCode::DatabaseBusy
                    || failure.code == rusqlite::ErrorCode::DatabaseLocked
        );
        Self::new(
            StorageErrorCode::DatabaseError,
            "本地数据库操作失败，请重试",
            retryable,
        )
    }
}

use std::path::Path;
use std::time::Duration;

use rusqlite::{backup::Backup, Connection};

use super::connection::timestamp;
use super::error::{StorageError, StorageErrorCode};

const MIGRATIONS: &[(i64, &str)] = &[(1, include_str!("../../migrations/001_v3_init.sql"))];

pub fn configure_connection(connection: &Connection) -> Result<(), StorageError> {
    connection.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA busy_timeout = 5000;",
    )?;
    Ok(())
}

pub fn apply_pending_migrations(
    connection: &mut Connection,
    backups_dir: Option<&Path>,
) -> Result<(), StorageError> {
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )?;
    let current_version: i64 = connection.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;

    for (version, sql) in MIGRATIONS {
        if *version <= current_version {
            continue;
        }
        if current_version > 0 {
            let directory = backups_dir.ok_or_else(|| {
                StorageError::new(
                    StorageErrorCode::MigrationFailed,
                    "数据库升级前无法创建保护备份",
                    true,
                )
            })?;
            create_online_backup(connection, directory, *version)?;
        }
        let transaction = connection.transaction().map_err(|_| {
            StorageError::new(
                StorageErrorCode::MigrationFailed,
                "数据库升级无法开始事务",
                true,
            )
        })?;
        transaction.execute_batch(sql).map_err(|_| {
            StorageError::new(
                StorageErrorCode::MigrationFailed,
                "数据库结构升级失败，已回滚本次变更",
                false,
            )
        })?;
        transaction
            .execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
                (version, timestamp()),
            )
            .map_err(|_| {
                StorageError::new(
                    StorageErrorCode::MigrationFailed,
                    "数据库升级记录失败，已回滚本次变更",
                    false,
                )
            })?;
        transaction.commit().map_err(|_| {
            StorageError::new(
                StorageErrorCode::MigrationFailed,
                "数据库升级提交失败，已回滚本次变更",
                false,
            )
        })?;
    }
    Ok(())
}

fn create_online_backup(
    source: &Connection,
    backups_dir: &Path,
    version: i64,
) -> Result<(), StorageError> {
    std::fs::create_dir_all(backups_dir)?;
    let destination_path =
        backups_dir.join(format!("pre-migration-v{version}-{}.sqlite3", timestamp()));
    let mut destination = Connection::open(&destination_path)?;
    let backup = Backup::new(source, &mut destination).map_err(|_| {
        StorageError::new(
            StorageErrorCode::MigrationFailed,
            "数据库升级前保护备份失败",
            true,
        )
    })?;
    backup
        .run_to_completion(100, Duration::from_millis(1), None)
        .map_err(|_| {
            StorageError::new(
                StorageErrorCode::MigrationFailed,
                "数据库升级前保护备份失败",
                true,
            )
        })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::{apply_pending_migrations, configure_connection};

    #[test]
    fn creates_schema_and_records_version_once() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        configure_connection(&connection).expect("configure");
        apply_pending_migrations(&mut connection, None).expect("migrate");
        apply_pending_migrations(&mut connection, None).expect("reopen");
        let version: i64 = connection
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("version");
        assert_eq!(version, 1);
    }
}

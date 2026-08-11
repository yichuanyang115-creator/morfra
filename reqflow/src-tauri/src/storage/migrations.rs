use std::path::Path;
use std::time::Duration;

use rusqlite::{backup::Backup, Connection};

use super::connection::timestamp;
use super::error::{StorageError, StorageErrorCode};

const MIGRATIONS: &[(i64, &str)] = &[
    (1, include_str!("../../migrations/001_v3_init.sql")),
    (
        2,
        include_str!("../../migrations/002_phase35_fields_records.sql"),
    ),
    (
        3,
        include_str!("../../migrations/003_phase35_detail_config.sql"),
    ),
    (4, include_str!("../../migrations/004_phase41_activity.sql")),
];

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
    let mut current_version: i64 = connection.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;

    for (version, sql) in MIGRATIONS {
        if *version <= current_version {
            continue;
        }
        if current_version > 0 {
            if let Some(directory) = backups_dir {
                create_online_backup(connection, directory, *version)?;
            } else {
                let database_path: String = connection
                    .query_row("PRAGMA database_list", [], |row| row.get(2))
                    .unwrap_or_default();
                if !database_path.is_empty() {
                    return Err(StorageError::new(
                        StorageErrorCode::MigrationFailed,
                        "数据库升级前无法创建保护备份",
                        true,
                    ));
                }
            }
        }
        // v2 rebuilds the two v1 tables whose CHECK/FK definitions cannot be
        // altered in place by SQLite. The migration itself is still atomic;
        // foreign-key checks are restored before returning, including errors.
        let foreign_keys_were_disabled = *version == 2;
        if foreign_keys_were_disabled {
            connection
                .execute_batch("PRAGMA foreign_keys = OFF;")
                .map_err(|_| {
                    StorageError::new(
                        StorageErrorCode::MigrationFailed,
                        "数据库结构升级无法暂时关闭外键检查",
                        true,
                    )
                })?;
        }
        let migration_result = match connection.transaction() {
            Ok(transaction) => transaction
                .execute_batch(sql)
                .map_err(|_| {
                    StorageError::new(
                        StorageErrorCode::MigrationFailed,
                        "数据库结构升级失败，已回滚本次变更",
                        false,
                    )
                })
                .and_then(|_| {
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
                        })
                })
                .and_then(|_| {
                    transaction.commit().map_err(|_| {
                        StorageError::new(
                            StorageErrorCode::MigrationFailed,
                            "数据库升级提交失败，已回滚本次变更",
                            false,
                        )
                    })
                }),
            Err(_) => Err(StorageError::new(
                StorageErrorCode::MigrationFailed,
                "数据库升级无法开始事务",
                true,
            )),
        };
        if foreign_keys_were_disabled {
            let _ = connection.execute_batch("PRAGMA foreign_keys = ON;");
        }
        migration_result?;
        current_version = *version;
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

    use super::{apply_pending_migrations, configure_connection, MIGRATIONS};

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
        assert_eq!(version, 4);
        let has_group_column: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('fields') WHERE name = 'group_id'",
                [],
                |row| row.get(0),
            )
            .expect("fields schema");
        assert_eq!(has_group_column, 1);
    }

    #[test]
    fn upgrades_an_existing_phase_35_database_without_losing_detail_configuration() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        configure_connection(&connection).expect("configure");
        connection.execute_batch("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);").expect("migration ledger");
        for (version, sql) in MIGRATIONS.iter().take(3) {
            connection.execute_batch(sql).expect("phase 35 schema");
            connection.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?1, 'before-phase-41')", [version]).expect("migration version");
        }
        connection.execute_batch("INSERT INTO project_meta (id, project_id, name, format_version, created_at, updated_at) VALUES ('project', 'existing-project', 'Existing', 1, 'before-phase-41', 'before-phase-41');\
            INSERT INTO data_tables (id, project_id, name, position, created_at, updated_at) VALUES ('existing-table', 'project', 'Existing table', 0, 'before-phase-41', 'before-phase-41');\
            INSERT INTO table_configs (table_id, detail_field_ids_json, updated_at) VALUES ('existing-table', '[\"field-priority\"]', 'before-phase-41');").expect("existing detail settings");

        apply_pending_migrations(&mut connection, None).expect("upgrade phase 41");

        let row: (String, Option<String>, i64, String) = connection.query_row(
            "SELECT detail_field_ids_json, activity_field_id, activity_tab_enabled, detail_tabs_json FROM table_configs WHERE table_id = 'existing-table'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        ).expect("upgraded configuration");
        assert_eq!(row.0, "[\"field-priority\"]");
        assert_eq!(row.1, None);
        assert_eq!(row.2, 0);
        assert_eq!(row.3, "[]");
    }
}

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
    (
        5,
        include_str!("../../migrations/005_phase42_attachments.sql"),
    ),
    (
        6,
        include_str!("../../migrations/006_phase45_table_icons.sql"),
    ),
    (
        7,
        include_str!("../../migrations/007_phase45_table_emoji.sql"),
    ),
    (
        8,
        include_str!("../../migrations/008_allow_duplicate_field_names.sql"),
    ),
    (9, include_str!("../../migrations/009_remove_field_groups.sql")),
    (
        10,
        include_str!("../../migrations/010_repair_field_foreign_keys.sql"),
    ),
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
        let foreign_keys_were_disabled = *version == 2 || *version == 8 || *version == 9;
        if foreign_keys_were_disabled {
            connection
                .execute_batch(if *version == 8 || *version == 9 { "PRAGMA foreign_keys = OFF; PRAGMA legacy_alter_table = ON;" } else { "PRAGMA foreign_keys = OFF;" })
                .map_err(|_| {
                    StorageError::new(
                        StorageErrorCode::MigrationFailed,
                        "数据库结构升级无法暂时关闭外键检查",
                        true,
                    )
                })?;
        }
        let migration_sql = if (*version == 6 && has_table_icon_column(connection)?)
            || (*version == 7 && has_table_emoji_column(connection)?)
        {
            ""
        } else {
            sql
        };
        let migration_result = match connection.transaction() {
            Ok(transaction) => transaction
                .execute_batch(migration_sql)
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
            let _ = connection.execute_batch(if *version == 8 || *version == 9 { "PRAGMA legacy_alter_table = OFF; PRAGMA foreign_keys = ON;" } else { "PRAGMA foreign_keys = ON;" });
        }
        migration_result?;
        current_version = *version;
    }
    Ok(())
}

fn has_table_icon_column(connection: &Connection) -> Result<bool, StorageError> {
    let count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('data_tables') WHERE name = 'icon'",
        [],
        |row| row.get(0),
    )?;
    Ok(count == 1)
}

fn has_table_emoji_column(connection: &Connection) -> Result<bool, StorageError> {
    let count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('data_tables') WHERE name = 'emoji'",
        [],
        |row| row.get(0),
    )?;
    Ok(count == 1)
}

fn create_online_backup(
    source: &Connection,
    backups_dir: &Path,
    version: i64,
) -> Result<(), StorageError> {
    std::fs::create_dir_all(backups_dir)?;
    let directory = backups_dir.join(format!("backup-pre-migration-v{version}-{}", timestamp()));
    std::fs::create_dir_all(&directory)?;
    let destination_path = directory.join("morfra.sqlite3");
    let mut destination = Connection::open(&destination_path)?;
    let backup = Backup::new(source, &mut destination).map_err(|_| {
        StorageError::new(
            StorageErrorCode::MigrationFailed,
            "数据库升级前保护备份失败",
            true,
        )
    })?;
    let result = backup
        .run_to_completion(100, Duration::from_millis(1), None)
        .map_err(|_| {
            StorageError::new(
                StorageErrorCode::MigrationFailed,
                "数据库升级前保护备份失败",
                true,
            )
        });
    if result.is_err() {
        let _ = std::fs::remove_dir_all(&directory);
    }
    result?;
    let root = backups_dir.parent().ok_or_else(|| {
        StorageError::new(
            StorageErrorCode::MigrationFailed,
            "数据库升级前保护备份路径无效",
            true,
        )
    })?;
    let manifest = root.join("project.json");
    if !manifest.is_file() {
        let _ = std::fs::remove_dir_all(&directory);
        return Err(StorageError::new(
            StorageErrorCode::MigrationFailed,
            "数据库升级前缺少可恢复项目元信息",
            true,
        ));
    }
    std::fs::copy(manifest, directory.join("project.json"))?;
    copy_directory(&root.join("attachments"), &directory.join("attachments"))?;
    super::backup::retain_latest(&super::connection::ProjectPaths::existing(root)?)?;
    Ok(())
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), StorageError> {
    std::fs::create_dir_all(destination)?;
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        let target = destination.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_directory(&entry.path(), &target)?;
        } else if entry.file_type()?.is_file() {
            std::fs::copy(entry.path(), target)?;
        }
    }
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
        assert_eq!(version, 10);
        let has_group_column: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('fields') WHERE name = 'group_id'",
                [],
                |row| row.get(0),
            )
            .expect("fields schema");
        assert_eq!(has_group_column, 0);
        let default_icon: String = connection
            .query_row(
                "SELECT dflt_value FROM pragma_table_info('data_tables') WHERE name = 'icon'",
                [],
                |row| row.get(0),
            )
            .expect("table icon schema");
        assert_eq!(default_icon, "'grid'");
        let default_emoji: String = connection
            .query_row(
                "SELECT dflt_value FROM pragma_table_info('data_tables') WHERE name = 'emoji'",
                [],
                |row| row.get(0),
            )
            .expect("table emoji schema");
        assert_eq!(default_emoji, "'📋'");
        let duplicate_name_constraint: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM pragma_index_list('fields') WHERE [unique] = 1 AND name NOT LIKE 'sqlite_autoindex_fields_%'",
                [],
                |row| row.get(0),
            )
            .expect("fields indexes");
        assert_eq!(duplicate_name_constraint, 1);
    }

    #[test]
    fn flattens_legacy_field_groups_without_losing_field_order_or_view_references() {
        let mut connection = Connection::open_in_memory().expect("database");
        configure_connection(&connection).expect("configure");
        connection.execute_batch("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);").expect("ledger");
        for (version, sql) in MIGRATIONS.iter().take(8) {
            connection.execute_batch(sql).expect("legacy schema");
            connection.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?1, 'before')", [version]).expect("version");
        }
        connection.execute_batch("INSERT INTO project_meta (id, project_id, name, format_version, created_at, updated_at) VALUES ('project', 'p', 'P', 1, '1', '1'); INSERT INTO data_tables (id, project_id, name, icon, emoji, position, created_at, updated_at) VALUES ('t', 'project', 'T', 'grid', '📋', 0, '1', '1'); INSERT INTO field_groups (id, table_id, name, position, created_at, updated_at) VALUES ('a','t','A',0,'1','1'),('b','t','B',1,'1','1'); INSERT INTO fields (id,table_id,group_id,name,field_type,is_title,position,config_json,created_at,updated_at) VALUES ('title','t',NULL,'标题','text',1,0,'{}','1','1'),('first','t','a','第一','text',0,2,'{}','1','1'),('second','t','b','第二','text',0,1,'{}','1','1'); INSERT INTO views (id,table_id,name,view_type,position,created_at,updated_at) VALUES ('v','t','表格','table',0,'1','1'); INSERT INTO view_configs (view_id,version,config_json,created_at,updated_at) VALUES ('v',1,'{\"fieldIds\":[\"title\",\"first\",\"second\"],\"groupOrder\":[\"b\",\"a\"]}','1','1');").expect("legacy data");
        apply_pending_migrations(&mut connection, None).expect("flatten");
        let fields: Vec<String> = connection.prepare("SELECT id FROM fields WHERE table_id = 't' ORDER BY position").expect("fields").query_map([], |row| row.get(0)).expect("rows").collect::<Result<_, _>>().expect("collect");
        assert_eq!(fields, ["title", "first", "second"]);
        let config: String = connection.query_row("SELECT config_json FROM view_configs WHERE view_id = 'v'", [], |row| row.get(0)).expect("config");
        assert!(config.contains("[\"title\",\"second\",\"first\"]"));
        assert!(!config.contains("groupOrder"));
        assert_eq!(connection.query_row::<i64, _, _>("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'field_groups'", [], |row| row.get(0)).expect("groups"), 0);
    }

    #[test]
    fn repairs_field_foreign_keys_after_duplicate_name_upgrade() {
        let mut connection = Connection::open_in_memory().expect("database");
        configure_connection(&connection).expect("configure");
        connection.execute_batch("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);").expect("ledger");
        for (version, sql) in MIGRATIONS.iter().take(7) {
            connection.execute_batch(sql).expect("legacy schema");
            connection.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?1, 'before')", [version]).expect("version");
        }
        connection.execute_batch("INSERT INTO project_meta (id, project_id, name, format_version, created_at, updated_at) VALUES ('project', 'p', 'P', 1, '1', '1'); INSERT INTO data_tables (id, project_id, name, icon, emoji, position, created_at, updated_at) VALUES ('t', 'project', 'T', 'grid', '📋', 0, '1', '1'); INSERT INTO fields (id, table_id, group_id, name, field_type, is_title, position, config_json, created_at, updated_at) VALUES ('title', 't', NULL, '标题', 'text', 1, 0, '{}', '1', '1'), ('tags', 't', NULL, '标签', 'multi_select', 0, 1, '{}', '1', '1'); INSERT INTO views (id, table_id, name, view_type, position, created_at, updated_at) VALUES ('v', 't', '表格', 'table', 0, '1', '1'); INSERT INTO view_configs (view_id, version, config_json, created_at, updated_at) VALUES ('v', 1, '{\"fieldIds\":[\"title\",\"tags\"]}', '1', '1'); INSERT INTO table_configs (table_id, detail_field_ids_json, activity_field_id, activity_tab_enabled, detail_tabs_json, updated_at) VALUES ('t', '[]', 'tags', 1, '[]', '1'); INSERT INTO records (id, table_id, position, auto_number, created_at, updated_at) VALUES ('r', 't', 0, 1, '1', '1'); INSERT INTO field_options (id, field_id, name, color, position, created_at, updated_at) VALUES ('option', 'tags', '重要', 'blue', 0, '1', '1'); INSERT INTO cell_values (record_id, field_id, value_json, updated_at) VALUES ('r', 'title', '\"可编辑标题\"', '1'); INSERT INTO multi_select_values (record_id, field_id, option_id, position) VALUES ('r', 'tags', 'option', 0); INSERT INTO activity_events (id, record_id, field_id, field_name_snapshot, occurred_at) VALUES ('event', 'r', 'tags', '标签', '1'); INSERT INTO activity_comments (id, event_id, content, created_at, updated_at) VALUES ('comment', 'event', '已记录', '1', '1'); INSERT INTO attachments (id, record_id, field_id, relative_path, original_name, media_type, byte_size, created_at) VALUES ('attachment', 'r', 'title', 'attachments/a.txt', 'a.txt', 'text/plain', 1, '1');").expect("legacy data");

        apply_pending_migrations(&mut connection, None).expect("repair foreign keys");

        let issues: i64 = connection.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| row.get(0)).expect("foreign key check");
        assert_eq!(issues, 0);
        let title: String = connection.query_row("SELECT value_json FROM cell_values WHERE record_id = 'r' AND field_id = 'title'", [], |row| row.get(0)).expect("preserved value");
        assert_eq!(title, "\"可编辑标题\"");
        for table in ["field_options", "multi_select_values", "table_configs", "activity_events", "activity_comments", "attachments"] {
            let count: i64 = connection.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0)).expect("preserved dependent data");
            assert_eq!(count, 1, "{table}");
        }
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
        let icon: String = connection
            .query_row(
                "SELECT icon FROM data_tables WHERE id = 'existing-table'",
                [],
                |row| row.get(0),
            )
            .expect("existing table icon");
        assert_eq!(icon, "grid");
        let emoji: String = connection
            .query_row(
                "SELECT emoji FROM data_tables WHERE id = 'existing-table'",
                [],
                |row| row.get(0),
            )
            .expect("existing table emoji");
        assert_eq!(emoji, "📋");
    }

    #[test]
    fn failed_table_icon_upgrade_rolls_back_schema_change() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        configure_connection(&connection).expect("configure");
        connection
            .execute_batch(include_str!("../../migrations/001_v3_init.sql"))
            .expect("base schema");

        let transaction = connection.transaction().expect("transaction");
        let result = transaction.execute_batch(
            "ALTER TABLE data_tables ADD COLUMN icon TEXT NOT NULL DEFAULT 'grid';
             INSERT INTO missing_migration_ledger(version) VALUES (6);",
        );
        assert!(result.is_err());
        drop(transaction);

        let icon_columns: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('data_tables') WHERE name = 'icon'",
                [],
                |row| row.get(0),
            )
            .expect("schema state");
        assert_eq!(icon_columns, 0);
    }

    #[test]
    fn upgrades_legacy_icons_to_default_emoji_without_rewriting_table_content() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        configure_connection(&connection).expect("configure");
        connection.execute_batch("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);").expect("migration ledger");
        for (version, sql) in MIGRATIONS.iter().take(6) {
            connection.execute_batch(sql).expect("legacy icon schema");
            connection.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?1, 'before-emoji')", [version]).expect("migration version");
        }
        connection.execute_batch("INSERT INTO project_meta (id, project_id, name, format_version, created_at, updated_at) VALUES ('project', 'existing-project', 'Existing', 1, 'before-emoji', 'before-emoji');
            INSERT INTO data_tables (id, project_id, name, icon, position, created_at, updated_at) VALUES ('existing-table', 'project', 'Existing table', 'board', 0, 'before-emoji', 'before-emoji');").expect("legacy table");

        apply_pending_migrations(&mut connection, None).expect("emoji upgrade");

        let row: (String, String, String) = connection
            .query_row(
                "SELECT name, icon, emoji FROM data_tables WHERE id = 'existing-table'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("upgraded table");
        assert_eq!(row, ("Existing table".into(), "board".into(), "📋".into()));
    }
}

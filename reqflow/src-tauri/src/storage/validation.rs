use rusqlite::Connection;

use super::error::{StorageError, StorageErrorCode};

pub fn validate_project_structure(connection: &Connection) -> Result<(), StorageError> {
    let table_count: i64 =
        connection.query_row("SELECT COUNT(*) FROM data_tables", [], |row| row.get(0))?;
    if table_count == 0 {
        return Err(StorageError::new(
            StorageErrorCode::DatabaseCorrupt,
            "项目数据库缺少默认表，无法安全打开",
            false,
        ));
    }

    let invalid_table_count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM data_tables AS t
         WHERE (SELECT COUNT(*) FROM fields WHERE table_id = t.id AND is_title = 1) != 1
            OR (SELECT COUNT(*) FROM fields WHERE table_id = t.id AND is_title = 1 AND position = 0) != 1
            OR (SELECT COUNT(*) FROM views WHERE table_id = t.id) = 0",
        [],
        |row| row.get(0),
    )?;
    let invalid_view_count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM views AS v
         WHERE NOT EXISTS (SELECT 1 FROM view_configs WHERE view_id = v.id)",
        [],
        |row| row.get(0),
    )?;
    if invalid_table_count > 0 || invalid_view_count > 0 {
        return Err(StorageError::new(
            StorageErrorCode::DatabaseCorrupt,
            "项目数据库结构不完整，无法安全打开",
            false,
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::validate_project_structure;

    #[test]
    fn rejects_a_database_without_a_default_table() {
        let connection = Connection::open_in_memory().expect("database");
        connection
            .execute_batch(
                "CREATE TABLE data_tables (id TEXT PRIMARY KEY);
                 CREATE TABLE fields (id TEXT PRIMARY KEY, table_id TEXT, is_title INTEGER, position INTEGER);
                 CREATE TABLE views (id TEXT PRIMARY KEY, table_id TEXT);
                 CREATE TABLE view_configs (view_id TEXT PRIMARY KEY);",
            )
            .expect("schema");

        let error = validate_project_structure(&connection).expect_err("invalid project");
        assert_eq!(
            error.code,
            super::super::error::StorageErrorCode::DatabaseCorrupt
        );
    }
}

use std::time::Instant;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use super::connection::timestamp;
use super::error::StorageError;
use super::migrations;

const RECORD_COUNT: i64 = 10_000;
const FIELD_COUNT: i64 = 200;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkReport {
    pub record_count: i64,
    pub field_count: i64,
    pub matched_candidates: i64,
    pub candidate_query_ms: u64,
}

pub fn run_in_memory() -> Result<BenchmarkReport, StorageError> {
    let mut connection = Connection::open_in_memory()?;
    migrations::configure_connection(&connection)?;
    migrations::apply_pending_migrations(&mut connection, None)?;
    seed_dataset(&mut connection)?;

    let started = Instant::now();
    let matched_candidates: i64 = connection.query_row(
        "SELECT COUNT(*) FROM records AS r
         JOIN cell_values AS v ON v.record_id = r.id
         WHERE v.field_id = 'benchmark-field-0' AND v.value_json LIKE ?1",
        [r#"%需求 999%"#],
        |row| row.get(0),
    )?;
    let candidate_query_ms = started.elapsed().as_millis() as u64;
    Ok(BenchmarkReport {
        record_count: RECORD_COUNT,
        field_count: FIELD_COUNT,
        matched_candidates,
        candidate_query_ms,
    })
}

fn seed_dataset(connection: &mut Connection) -> Result<(), StorageError> {
    let transaction = connection.transaction()?;
    let now = timestamp();
    transaction.execute(
        "INSERT INTO project_meta (id, project_id, name, format_version, created_at, updated_at)
         VALUES ('project', 'benchmark-project', '基准项目', 1, ?1, ?1)",
        [&now],
    )?;
    transaction.execute(
        "INSERT INTO data_tables (id, project_id, name, position, created_at, updated_at)
         VALUES ('benchmark-table', 'project', '基准表', 0, ?1, ?1)",
        [&now],
    )?;
    for field_index in 0..FIELD_COUNT {
        transaction.execute(
            "INSERT INTO fields
             (id, table_id, name, field_type, is_title, position, config_json, created_at, updated_at)
             VALUES (?1, 'benchmark-table', ?2, 'text', ?3, ?4, '{}', ?5, ?5)",
            (
                format!("benchmark-field-{field_index}"),
                format!("字段 {field_index}"),
                if field_index == 0 { 1_i64 } else { 0_i64 },
                field_index,
                &now,
            ),
        )?;
    }
    transaction.execute(
        "INSERT INTO views (id, table_id, name, view_type, position, created_at, updated_at)
         VALUES ('benchmark-view', 'benchmark-table', '表格', 'table', 0, ?1, ?1)",
        [&now],
    )?;
    transaction.execute(
        "INSERT INTO view_configs (view_id, version, config_json, created_at, updated_at)
         VALUES ('benchmark-view', 1, '{}', ?1, ?1)",
        [&now],
    )?;
    {
        let mut statement = transaction.prepare(
            "INSERT INTO records (id, table_id, position, auto_number, created_at, updated_at)
             VALUES (?1, 'benchmark-table', ?2, ?2 + 1, ?3, ?3)",
        )?;
        for record_index in 0..RECORD_COUNT {
            statement.execute((
                format!("benchmark-record-{record_index}"),
                record_index,
                &now,
            ))?;
        }
    }
    {
        let mut statement = transaction.prepare(
            "INSERT INTO cell_values (record_id, field_id, value_json, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
        )?;
        for record_index in 0..RECORD_COUNT {
            for field_index in 0..FIELD_COUNT {
                let value = if field_index == 0 {
                    format!("需求 {record_index}")
                } else {
                    format!("值 {field_index}-{record_index}")
                };
                statement.execute((
                    format!("benchmark-record-{record_index}"),
                    format!("benchmark-field-{field_index}"),
                    serde_json::to_string(&value)?,
                    &now,
                ))?;
            }
        }
    }
    transaction.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::run_in_memory;

    #[test]
    fn benchmark_generates_target_shape_and_stays_under_query_budget() {
        let report = run_in_memory().expect("benchmark");
        println!("benchmark report: {report:?}");
        assert_eq!(report.record_count, 10_000);
        assert_eq!(report.field_count, 200);
        assert!(report.matched_candidates > 0);
        assert!(report.matched_candidates < report.record_count);
        assert!(report.candidate_query_ms < 300);
    }
}

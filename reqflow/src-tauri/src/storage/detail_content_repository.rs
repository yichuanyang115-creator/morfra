use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::connection::timestamp;
use super::error::StorageError;

const BODY_MAX_LEN: usize = 200_000;
const ITEM_MAX_COUNT: usize = 1_000;
const DETAIL_RENDERERS: [&str; 5] = ["body", "deliverables", "tasks", "acceptance", "activity"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DetailTabDefinition {
    pub id: String,
    pub name: String,
    pub renderer: String,
    #[serde(default = "default_visible")]
    pub visible: bool,
}

fn default_visible() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeliverableContent {
    pub id: String,
    pub name: String,
    pub checked: bool,
    pub attach: Option<Value>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TaskContent {
    pub id: String,
    pub name: String,
    pub assignee: String,
    pub deadline: String,
    pub progress: Option<f64>,
    pub status: String,
    pub blocked: bool,
    pub block_note: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AcceptanceContent {
    pub id: String,
    pub desc: String,
    pub result: String,
    pub fail_note: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecordDetailContent {
    pub record_id: String,
    pub body: String,
    pub deliverables: Vec<DeliverableContent>,
    pub tasks: Vec<TaskContent>,
    pub acceptance: Vec<AcceptanceContent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecordDetailContentInput {
    pub body: String,
    pub deliverables: Vec<DeliverableContent>,
    pub tasks: Vec<TaskContent>,
    pub acceptance: Vec<AcceptanceContent>,
}

pub fn load_detail_tabs(connection: &Connection, table_id: &str) -> Result<Vec<DetailTabDefinition>, StorageError> {
    let raw: Option<String> = connection.query_row(
        "SELECT detail_tabs_json FROM table_configs WHERE table_id = ?1",
        [table_id],
        |row| row.get(0),
    ).optional()?;
    let raw = raw.ok_or_else(|| StorageError::validation("表不存在"))?;
    let tabs: Vec<DetailTabDefinition> = serde_json::from_str(&raw).map_err(|_| StorageError::validation("详情 Tab 配置损坏"))?;
    if tabs.iter().any(|tab| !DETAIL_RENDERERS.contains(&tab.renderer.as_str())) {
        return Err(StorageError::validation("详情 Tab 配置包含不支持的类型"));
    }
    Ok(tabs)
}

pub fn load_record_detail_content(connection: &Connection, record_id: &str) -> Result<RecordDetailContent, StorageError> {
    ensure_record_exists(connection, record_id)?;
    let row: Option<(String, String, String, String)> = connection.query_row(
        "SELECT body, deliverables_json, tasks_json, acceptance_json FROM record_detail_contents WHERE record_id = ?1",
        [record_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    ).optional()?;
    match row {
        Some((body, deliverables, tasks, acceptance)) => decode_content(record_id, body, deliverables, tasks, acceptance),
        None => Ok(empty_content(record_id)),
    }
}

pub fn save_record_detail_content(connection: &mut Connection, record_id: &str, input: RecordDetailContentInput) -> Result<RecordDetailContent, StorageError> {
    validate_content(&input)?;
    let transaction = connection.transaction()?;
    ensure_record_exists(&transaction, record_id)?;
    let now = timestamp();
    transaction.execute(
        "INSERT INTO record_detail_contents (record_id, body, deliverables_json, tasks_json, acceptance_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)\
         ON CONFLICT(record_id) DO UPDATE SET body = excluded.body, deliverables_json = excluded.deliverables_json, tasks_json = excluded.tasks_json, acceptance_json = excluded.acceptance_json, updated_at = excluded.updated_at",
        params![record_id, input.body, serde_json::to_string(&input.deliverables)?, serde_json::to_string(&input.tasks)?, serde_json::to_string(&input.acceptance)?, now],
    )?;
    transaction.execute("UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'", [timestamp()])?;
    transaction.commit()?;
    Ok(RecordDetailContent { record_id: record_id.to_string(), body: input.body, deliverables: input.deliverables, tasks: input.tasks, acceptance: input.acceptance })
}

fn ensure_record_exists(connection: &Connection, record_id: &str) -> Result<(), StorageError> {
    let found: Option<i64> = connection.query_row("SELECT 1 FROM records WHERE id = ?1", [record_id], |row| row.get(0)).optional()?;
    if found.is_some() { Ok(()) } else { Err(StorageError::validation("记录不存在")) }
}

fn empty_content(record_id: &str) -> RecordDetailContent {
    RecordDetailContent { record_id: record_id.to_string(), body: String::new(), deliverables: Vec::new(), tasks: Vec::new(), acceptance: Vec::new() }
}

fn decode_content(record_id: &str, body: String, deliverables: String, tasks: String, acceptance: String) -> Result<RecordDetailContent, StorageError> {
    let input = RecordDetailContentInput {
        body,
        deliverables: serde_json::from_str(&deliverables).map_err(|_| StorageError::validation("产出详情数据损坏"))?,
        tasks: serde_json::from_str(&tasks).map_err(|_| StorageError::validation("任务详情数据损坏"))?,
        acceptance: serde_json::from_str(&acceptance).map_err(|_| StorageError::validation("验收详情数据损坏"))?,
    };
    validate_content(&input)?;
    Ok(RecordDetailContent { record_id: record_id.to_string(), body: input.body, deliverables: input.deliverables, tasks: input.tasks, acceptance: input.acceptance })
}

fn validate_content(input: &RecordDetailContentInput) -> Result<(), StorageError> {
    if input.body.chars().count() > BODY_MAX_LEN || input.deliverables.len() > ITEM_MAX_COUNT || input.tasks.len() > ITEM_MAX_COUNT || input.acceptance.len() > ITEM_MAX_COUNT {
        return Err(StorageError::validation("详情内容超出允许范围"));
    }
    if input.deliverables.iter().any(|item| item.id.trim().is_empty() || item.name.trim().is_empty())
        || input.tasks.iter().any(|item| item.id.trim().is_empty() || item.name.trim().is_empty() || !["todo", "progress", "done"].contains(&item.status.as_str()))
        || input.acceptance.iter().any(|item| item.id.trim().is_empty() || item.desc.trim().is_empty() || !["pass", "fail", "unverified"].contains(&item.result.as_str())) {
        return Err(StorageError::validation("详情内容包含无效条目"));
    }
    Ok(())
}

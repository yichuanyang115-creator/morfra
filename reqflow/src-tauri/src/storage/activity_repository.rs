use rusqlite::{params, OptionalExtension, Transaction};
use serde::Serialize;
use serde_json::Value;

use super::connection::timestamp;
use super::error::StorageError;
use super::field_models::FieldRow;
use super::repository::new_id;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEvent {
    pub id: String,
    pub record_id: String,
    pub field_id: Option<String>,
    pub field_name_snapshot: String,
    pub from_value_snapshot: Option<String>,
    pub to_value_snapshot: Option<String>,
    pub occurred_at: String,
    pub note: Option<String>,
    pub comments: Vec<ActivityComment>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityComment {
    pub id: String,
    pub event_id: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityBinding {
    pub enabled: bool,
    pub field_id: Option<String>,
}

pub fn activity_binding(
    connection: &rusqlite::Connection,
    table_id: &str,
) -> Result<ActivityBinding, StorageError> {
    connection
        .query_row(
            "SELECT activity_tab_enabled, activity_field_id FROM table_configs WHERE table_id = ?1",
            [table_id],
            |row| {
                Ok(ActivityBinding {
                    enabled: row.get::<_, i64>(0)? == 1,
                    field_id: row.get(1)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| StorageError::validation("表不存在"))
}

pub fn activity_field_id(
    transaction: &Transaction<'_>,
    table_id: &str,
) -> Result<Option<String>, StorageError> {
    transaction.query_row(
        "SELECT activity_field_id FROM table_configs WHERE table_id = ?1 AND activity_tab_enabled = 1",
        [table_id],
        |row| row.get(0),
    ).optional().map_err(StorageError::from).map(|value| value.flatten())
}

pub fn bind_activity_field(
    transaction: &Transaction<'_>,
    table_id: &str,
    field_id: Option<&str>,
) -> Result<(), StorageError> {
    if let Some(id) = field_id {
        let valid: Option<i64> = transaction
            .query_row(
                "SELECT 1 FROM fields WHERE id = ?1 AND table_id = ?2 AND field_type = 'select'",
                params![id, table_id],
                |row| row.get(0),
            )
            .optional()?;
        if valid.is_none() {
            return Err(StorageError::validation("活动只能关联当前表的普通单选字段"));
        }
    }
    transaction.execute(
        "UPDATE table_configs SET activity_field_id = ?1, activity_tab_enabled = 1, updated_at = ?2 WHERE table_id = ?3",
        params![field_id, timestamp(), table_id],
    )?;
    Ok(())
}

pub fn track_select_change(
    transaction: &Transaction<'_>,
    record_id: &str,
    field: &FieldRow,
    old_value: &Value,
    new_value: &Value,
) -> Result<(), StorageError> {
    track_select_change_with_id(transaction, record_id, field, old_value, new_value).map(|_| ())
}

pub fn track_select_change_with_id(
    transaction: &Transaction<'_>,
    record_id: &str,
    field: &FieldRow,
    old_value: &Value,
    new_value: &Value,
) -> Result<Option<String>, StorageError> {
    if field.field_type != "select"
        || activity_field_id(transaction, &field.table_id)?.as_deref() != Some(field.id.as_str())
        || old_value == new_value
    {
        return Ok(None);
    }
    let from = option_name(transaction, old_value)?;
    let to = option_name(transaction, new_value)?;
    let id = new_id("activity");
    transaction.execute(
        "INSERT INTO activity_events (id, record_id, field_id, field_name_snapshot, from_value_snapshot, to_value_snapshot, occurred_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, record_id, field.id, field.name, from, to, timestamp()],
    )?;
    Ok(Some(id))
}

fn option_name(
    transaction: &Transaction<'_>,
    value: &Value,
) -> Result<Option<String>, StorageError> {
    let Some(option_id) = value.as_str() else {
        return Ok(None);
    };
    transaction
        .query_row(
            "SELECT name FROM field_options WHERE id = ?1",
            [option_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(StorageError::from)
}

pub fn load_events(
    connection: &rusqlite::Connection,
    record_id: &str,
) -> Result<Vec<ActivityEvent>, StorageError> {
    let mut statement = connection.prepare("SELECT id, record_id, field_id, field_name_snapshot, from_value_snapshot, to_value_snapshot, occurred_at, note FROM activity_events WHERE record_id = ?1 ORDER BY occurred_at DESC, id DESC")?;
    let rows = statement.query_map([record_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
        ))
    })?;
    rows.map(|row| {
        let (
            id,
            record_id,
            field_id,
            field_name_snapshot,
            from_value_snapshot,
            to_value_snapshot,
            occurred_at,
            note,
        ) = row?;
        Ok(ActivityEvent {
            comments: load_comments(connection, &id)?,
            id,
            record_id,
            field_id,
            field_name_snapshot,
            from_value_snapshot,
            to_value_snapshot,
            occurred_at,
            note,
        })
    })
    .collect::<Result<Vec<_>, StorageError>>()
}

pub fn update_note(
    connection: &mut rusqlite::Connection,
    event_id: &str,
    note: Option<&str>,
) -> Result<(), StorageError> {
    let note = note.map(str::trim).filter(|text| !text.is_empty());
    if connection.execute(
        "UPDATE activity_events SET note = ?1 WHERE id = ?2",
        params![note, event_id],
    )? != 1
    {
        return Err(StorageError::validation("活动节点不存在"));
    }
    Ok(())
}
pub fn create_comment(
    connection: &mut rusqlite::Connection,
    event_id: &str,
    content: &str,
) -> Result<ActivityComment, StorageError> {
    let content = content.trim();
    if content.is_empty() {
        return Err(StorageError::validation("评论不能为空"));
    }
    let created_at = timestamp();
    let comment = ActivityComment {
        id: new_id("activity_comment"),
        event_id: event_id.to_string(),
        content: content.to_string(),
        created_at,
    };
    connection.execute("INSERT INTO activity_comments (id, event_id, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)", params![comment.id, comment.event_id, comment.content, comment.created_at])?;
    Ok(comment)
}
pub fn delete_event(
    connection: &mut rusqlite::Connection,
    event_id: &str,
) -> Result<(), StorageError> {
    if connection.execute("DELETE FROM activity_events WHERE id = ?1", [event_id])? != 1 {
        return Err(StorageError::validation("活动节点不存在"));
    }
    Ok(())
}

fn load_comments(
    connection: &rusqlite::Connection,
    event_id: &str,
) -> Result<Vec<ActivityComment>, StorageError> {
    let mut statement = connection.prepare("SELECT id, event_id, content, created_at FROM activity_comments WHERE event_id = ?1 ORDER BY created_at ASC, id ASC")?;
    let rows = statement.query_map([event_id], |row| {
        Ok(ActivityComment {
            id: row.get(0)?,
            event_id: row.get(1)?,
            content: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from)
}

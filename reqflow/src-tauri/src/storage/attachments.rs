use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::connection::{timestamp, ProjectPaths};
use super::error::{StorageError, StorageErrorCode};
use super::repository::new_id;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub record_id: String,
    pub field_id: String,
    pub relative_path: String,
    pub original_name: String,
    pub media_type: Option<String>,
    pub byte_size: u64,
    pub created_at: String,
}

pub fn add_file(
    paths: &ProjectPaths,
    connection: &mut Connection,
    record_id: &str,
    field_id: &str,
    source: &Path,
) -> Result<Attachment, StorageError> {
    let source_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .ok_or_else(|| StorageError::validation("附件文件名无效"))?;
    let metadata = fs::metadata(source).map_err(|_| {
        StorageError::new(
            StorageErrorCode::AttachmentMissing,
            "选择的附件已不存在或无法读取",
            true,
        )
    })?;
    if !metadata.is_file() {
        return Err(StorageError::validation("只能添加普通文件作为附件"));
    }
    let id = new_id("attachment");
    let extension = source
        .extension()
        .and_then(|ext| ext.to_str())
        .filter(|ext| !ext.is_empty())
        .map(|ext| format!(".{ext}"))
        .unwrap_or_default();
    let relative_path = format!("attachments/{id}{extension}");
    let final_path = paths.root.join(&relative_path);
    let temporary_path = paths.attachments.join(format!(".{id}.partial"));
    fs::copy(source, &temporary_path)?;
    let result = (|| {
        let transaction = connection.transaction()?;
        let field_type: String = transaction.query_row("SELECT f.field_type FROM fields f JOIN records r ON r.table_id = f.table_id WHERE f.id = ?1 AND r.id = ?2", params![field_id, record_id], |row| row.get(0)).optional()?.ok_or_else(|| StorageError::validation("附件所属记录或字段不存在"))?;
        if field_type != "image" && field_type != "file" {
            return Err(StorageError::validation("只有图片或文件字段可以添加附件"));
        }
        fs::rename(&temporary_path, &final_path)?;
        let attachment = Attachment {
            id: id.clone(),
            record_id: record_id.into(),
            field_id: field_id.into(),
            relative_path: relative_path.clone(),
            original_name: source_name.into(),
            media_type: media_type(source),
            byte_size: metadata.len(),
            created_at: timestamp(),
        };
        transaction.execute("INSERT INTO attachments (id, record_id, field_id, relative_path, original_name, media_type, byte_size, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)", params![attachment.id, attachment.record_id, attachment.field_id, attachment.relative_path, attachment.original_name, attachment.media_type, attachment.byte_size as i64, attachment.created_at])?;
        append_cell_value(&transaction, record_id, field_id, &relative_path)?;
        transaction.execute(
            "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
            [timestamp()],
        )?;
        transaction.commit()?;
        Ok(attachment)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary_path);
        let _ = fs::remove_file(&final_path);
    }
    result
}

pub fn remove_file(
    paths: &ProjectPaths,
    connection: &mut Connection,
    attachment_id: &str,
) -> Result<(), StorageError> {
    let attachment = find(connection, attachment_id)?;
    let final_path = paths.root.join(&attachment.relative_path);
    let staged_path = paths
        .attachments
        .join(format!(".{}.removing", attachment.id));
    if final_path.exists() {
        fs::rename(&final_path, &staged_path)?;
    }
    let result = (|| {
        let transaction = connection.transaction()?;
        transaction.execute("DELETE FROM attachments WHERE id = ?1", [attachment_id])?;
        remove_cell_value(
            &transaction,
            &attachment.record_id,
            &attachment.field_id,
            &attachment.relative_path,
        )?;
        transaction.execute(
            "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
            [timestamp()],
        )?;
        transaction.commit()?;
        Ok::<(), StorageError>(())
    })();
    if result.is_err() && staged_path.exists() {
        let _ = fs::rename(&staged_path, &final_path);
    }
    if result.is_ok() {
        let _ = fs::remove_file(staged_path);
    }
    result
}

pub fn replace_file(
    paths: &ProjectPaths,
    connection: &mut Connection,
    attachment_id: &str,
    source: &Path,
) -> Result<Attachment, StorageError> {
    let previous = find(connection, attachment_id)?;
    let source_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .ok_or_else(|| StorageError::validation("附件文件名无效"))?;
    let metadata = fs::metadata(source).map_err(|_| {
        StorageError::new(
            StorageErrorCode::AttachmentMissing,
            "选择的附件已不存在或无法读取",
            true,
        )
    })?;
    if !metadata.is_file() {
        return Err(StorageError::validation("只能添加普通文件作为附件"));
    }
    let id = new_id("attachment");
    let extension = source
        .extension()
        .and_then(|ext| ext.to_str())
        .filter(|ext| !ext.is_empty())
        .map(|ext| format!(".{ext}"))
        .unwrap_or_default();
    let relative_path = format!("attachments/{id}{extension}");
    let temporary_path = paths.attachments.join(format!(".{id}.partial"));
    let final_path = paths.root.join(&relative_path);
    let old_path = paths.root.join(&previous.relative_path);
    let staged_old = paths
        .attachments
        .join(format!(".{}.replacing", previous.id));
    fs::copy(source, &temporary_path)?;
    let result = (|| {
        if old_path.exists() {
            fs::rename(&old_path, &staged_old)?;
        }
        fs::rename(&temporary_path, &final_path)?;
        let transaction = connection.transaction()?;
        let attachment = Attachment {
            id: id.clone(),
            record_id: previous.record_id.clone(),
            field_id: previous.field_id.clone(),
            relative_path: relative_path.clone(),
            original_name: source_name.into(),
            media_type: media_type(source),
            byte_size: metadata.len(),
            created_at: timestamp(),
        };
        transaction.execute("INSERT INTO attachments (id, record_id, field_id, relative_path, original_name, media_type, byte_size, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)", params![attachment.id, attachment.record_id, attachment.field_id, attachment.relative_path, attachment.original_name, attachment.media_type, attachment.byte_size as i64, attachment.created_at])?;
        transaction.execute("DELETE FROM attachments WHERE id = ?1", [attachment_id])?;
        replace_cell_value(
            &transaction,
            &previous.record_id,
            &previous.field_id,
            &previous.relative_path,
            &relative_path,
        )?;
        transaction.execute(
            "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
            [timestamp()],
        )?;
        transaction.commit()?;
        Ok(attachment)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary_path);
        let _ = fs::remove_file(&final_path);
        if staged_old.exists() {
            let _ = fs::rename(&staged_old, &old_path);
        }
    } else {
        let _ = fs::remove_file(&staged_old);
    }
    result
}

pub fn list_for_cell(
    connection: &Connection,
    record_id: &str,
    field_id: &str,
) -> Result<Vec<Attachment>, StorageError> {
    let mut statement = connection.prepare("SELECT id, record_id, field_id, relative_path, original_name, media_type, byte_size, created_at FROM attachments WHERE record_id = ?1 AND field_id = ?2 ORDER BY created_at")?;
    let attachments = statement
        .query_map(params![record_id, field_id], row_to_attachment)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(StorageError::from)?;
    Ok(attachments)
}

pub fn resolve_path(
    paths: &ProjectPaths,
    attachment_id: &str,
    connection: &Connection,
) -> Result<PathBuf, StorageError> {
    let attachment = find(connection, attachment_id)?;
    let path = paths.root.join(&attachment.relative_path);
    if !path.is_file() {
        return Err(StorageError::new(
            StorageErrorCode::AttachmentMissing,
            "附件文件缺失；可移除该引用或从备份恢复",
            true,
        ));
    }
    Ok(path)
}

pub fn cleanup_unreferenced(
    paths: &ProjectPaths,
    connection: &Connection,
) -> Result<(), StorageError> {
    let mut statement = connection.prepare("SELECT relative_path FROM attachments")?;
    let referenced = statement
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<std::collections::HashSet<_>, _>>()?;
    for entry in fs::read_dir(&paths.attachments)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        let relative = format!("attachments/{name}");
        if name.starts_with('.') || !referenced.contains(&relative) {
            fs::remove_file(entry.path())?;
        }
    }
    Ok(())
}

fn find(connection: &Connection, attachment_id: &str) -> Result<Attachment, StorageError> {
    connection.query_row("SELECT id, record_id, field_id, relative_path, original_name, media_type, byte_size, created_at FROM attachments WHERE id = ?1", [attachment_id], row_to_attachment).optional()?.ok_or_else(|| StorageError::new(StorageErrorCode::AttachmentMissing, "附件引用不存在", false))
}
fn row_to_attachment(row: &rusqlite::Row<'_>) -> rusqlite::Result<Attachment> {
    Ok(Attachment {
        id: row.get(0)?,
        record_id: row.get(1)?,
        field_id: row.get(2)?,
        relative_path: row.get(3)?,
        original_name: row.get(4)?,
        media_type: row.get(5)?,
        byte_size: row.get::<_, i64>(6)? as u64,
        created_at: row.get(7)?,
    })
}
fn append_cell_value(
    transaction: &rusqlite::Transaction<'_>,
    record_id: &str,
    field_id: &str,
    relative_path: &str,
) -> Result<(), StorageError> {
    let mut values = existing_values(transaction, record_id, field_id)?;
    values.push(Value::String(relative_path.into()));
    transaction.execute("INSERT INTO cell_values (record_id, field_id, value_json, updated_at) VALUES (?1, ?2, json(?3), ?4) ON CONFLICT(record_id, field_id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at", params![record_id, field_id, Value::Array(values).to_string(), timestamp()])?;
    Ok(())
}
fn remove_cell_value(
    transaction: &rusqlite::Transaction<'_>,
    record_id: &str,
    field_id: &str,
    relative_path: &str,
) -> Result<(), StorageError> {
    let values = existing_values(transaction, record_id, field_id)?
        .into_iter()
        .filter(|value| value.as_str() != Some(relative_path))
        .collect::<Vec<_>>();
    if values.is_empty() {
        transaction.execute(
            "DELETE FROM cell_values WHERE record_id = ?1 AND field_id = ?2",
            params![record_id, field_id],
        )?;
    } else {
        transaction.execute("UPDATE cell_values SET value_json = json(?3), updated_at = ?4 WHERE record_id = ?1 AND field_id = ?2", params![record_id, field_id, Value::Array(values).to_string(), timestamp()])?;
    }
    Ok(())
}
fn replace_cell_value(
    transaction: &rusqlite::Transaction<'_>,
    record_id: &str,
    field_id: &str,
    old_path: &str,
    new_path: &str,
) -> Result<(), StorageError> {
    let values = existing_values(transaction, record_id, field_id)?
        .into_iter()
        .map(|value| {
            if value.as_str() == Some(old_path) {
                Value::String(new_path.into())
            } else {
                value
            }
        })
        .collect::<Vec<_>>();
    transaction.execute("UPDATE cell_values SET value_json = json(?3), updated_at = ?4 WHERE record_id = ?1 AND field_id = ?2", params![record_id, field_id, Value::Array(values).to_string(), timestamp()])?;
    Ok(())
}
fn existing_values(
    transaction: &rusqlite::Transaction<'_>,
    record_id: &str,
    field_id: &str,
) -> Result<Vec<Value>, StorageError> {
    let value: Option<String> = transaction
        .query_row(
            "SELECT value_json FROM cell_values WHERE record_id = ?1 AND field_id = ?2",
            params![record_id, field_id],
            |row| row.get(0),
        )
        .optional()?;
    match value {
        Some(raw) => match serde_json::from_str::<Value>(&raw).unwrap_or(Value::Null) {
            Value::Array(values) => Ok(values),
            Value::String(value) if !value.is_empty() => Ok(vec![Value::String(value)]),
            _ => Ok(Vec::new()),
        },
        None => Ok(Vec::new()),
    }
}
fn media_type(path: &Path) -> Option<String> {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => Some("image/png".into()),
        Some("jpg" | "jpeg") => Some("image/jpeg".into()),
        Some("gif") => Some("image/gif".into()),
        Some("webp") => Some("image/webp".into()),
        Some("pdf") => Some("application/pdf".into()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{add_file, list_for_cell, remove_file, replace_file, resolve_path};
    use crate::storage::connection::{create_project, open_project, ProjectPaths};
    use crate::storage::{field_repository, record_repository};
    use serde_json::json;
    use std::collections::HashMap;
    use std::fs;
    fn root(label: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("morfra-attachment-{label}-{}", std::process::id()))
    }
    #[test]
    fn copies_relative_attachment_and_removes_without_orphan() {
        let root = root("copy");
        let _ = fs::remove_dir_all(&root);
        create_project(&root, "附件").unwrap();
        let mut opened = open_project(&root).unwrap();
        let table = field_repository::load_table_data(
            &opened.connection,
            &crate::storage::repository::load_snapshot(&opened.connection, &opened.manifest)
                .unwrap()
                .tables[0]
                .id,
        )
        .unwrap();
        let field = field_repository::create_field(
            &mut opened.connection,
            &table.table_id,
            "文件",
            "file",
            json!({}),
            None,
        )
        .unwrap();
        let title = table
            .fields
            .into_iter()
            .find(|field| field.is_title)
            .unwrap();
        let record = record_repository::create_record(
            &mut opened.connection,
            &table.table_id,
            HashMap::from([(title.id, json!("附件记录"))]),
        )
        .unwrap();
        let source = root.with_extension("source.txt");
        fs::write(&source, "attachment-body").unwrap();
        let paths = ProjectPaths::existing(&root).unwrap();
        let attachment =
            add_file(&paths, &mut opened.connection, &record, &field, &source).unwrap();
        assert!(attachment.relative_path.starts_with("attachments/"));
        assert!(!attachment
            .relative_path
            .contains(root.to_string_lossy().as_ref()));
        assert_eq!(
            fs::read(resolve_path(&paths, &attachment.id, &opened.connection).unwrap()).unwrap(),
            b"attachment-body"
        );
        remove_file(&paths, &mut opened.connection, &attachment.id).unwrap();
        assert!(list_for_cell(&opened.connection, &record, &field)
            .unwrap()
            .is_empty());
        assert!(!paths.root.join(attachment.relative_path).exists());
        let _ = fs::remove_file(source);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn replacement_swaps_metadata_and_file() {
        let root = root("replace");
        let _ = fs::remove_dir_all(&root);
        create_project(&root, "附件").unwrap();
        let mut opened = open_project(&root).unwrap();
        let table = field_repository::load_table_data(
            &opened.connection,
            &crate::storage::repository::load_snapshot(&opened.connection, &opened.manifest)
                .unwrap()
                .tables[0]
                .id,
        )
        .unwrap();
        let field = field_repository::create_field(
            &mut opened.connection,
            &table.table_id,
            "文件",
            "file",
            json!({}),
            None,
        )
        .unwrap();
        let title = table
            .fields
            .into_iter()
            .find(|field| field.is_title)
            .unwrap();
        let record = record_repository::create_record(
            &mut opened.connection,
            &table.table_id,
            HashMap::from([(title.id, json!("附件记录"))]),
        )
        .unwrap();
        let first = root.with_extension("first.txt");
        let second = root.with_extension("second.txt");
        fs::write(&first, "old").unwrap();
        fs::write(&second, "new").unwrap();
        let paths = ProjectPaths::existing(&root).unwrap();
        let old = add_file(&paths, &mut opened.connection, &record, &field, &first).unwrap();
        let new = replace_file(&paths, &mut opened.connection, &old.id, &second).unwrap();
        assert!(!paths.root.join(old.relative_path).exists());
        assert_eq!(
            fs::read(resolve_path(&paths, &new.id, &opened.connection).unwrap()).unwrap(),
            b"new"
        );
        assert_eq!(
            list_for_cell(&opened.connection, &record, &field)
                .unwrap()
                .len(),
            1
        );
        let _ = fs::remove_file(first);
        let _ = fs::remove_file(second);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn replacement_database_failure_restores_old_attachment() {
        let root = root("replace-rollback");
        let _ = fs::remove_dir_all(&root);
        create_project(&root, "附件").unwrap();
        let mut opened = open_project(&root).unwrap();
        let table = field_repository::load_table_data(
            &opened.connection,
            &crate::storage::repository::load_snapshot(&opened.connection, &opened.manifest)
                .unwrap()
                .tables[0]
                .id,
        )
        .unwrap();
        let field = field_repository::create_field(
            &mut opened.connection,
            &table.table_id,
            "文件",
            "file",
            json!({}),
            None,
        )
        .unwrap();
        let title = table
            .fields
            .into_iter()
            .find(|field| field.is_title)
            .unwrap();
        let record = record_repository::create_record(
            &mut opened.connection,
            &table.table_id,
            HashMap::from([(title.id, json!("附件记录"))]),
        )
        .unwrap();
        let first = root.with_extension("first.txt");
        let second = root.with_extension("second.txt");
        fs::write(&first, "old").unwrap();
        fs::write(&second, "new").unwrap();
        let paths = ProjectPaths::existing(&root).unwrap();
        let old = add_file(&paths, &mut opened.connection, &record, &field, &first).unwrap();
        opened.connection.execute_batch("CREATE TRIGGER fail_replace BEFORE INSERT ON attachments BEGIN SELECT RAISE(FAIL, 'injected replacement failure'); END;").unwrap();
        assert!(replace_file(&paths, &mut opened.connection, &old.id, &second).is_err());
        assert_eq!(
            fs::read(paths.root.join(&old.relative_path)).unwrap(),
            b"old"
        );
        let attachments = list_for_cell(&opened.connection, &record, &field).unwrap();
        assert_eq!(attachments.len(), 1);
        assert_eq!(attachments[0].id, old.id);
        assert_eq!(fs::read_dir(&paths.attachments).unwrap().count(), 1);
        let _ = fs::remove_file(first);
        let _ = fs::remove_file(second);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn rejected_database_write_cleans_the_staged_copy() {
        let root = root("rollback");
        let _ = fs::remove_dir_all(&root);
        create_project(&root, "附件").unwrap();
        let mut opened = open_project(&root).unwrap();
        let table = field_repository::load_table_data(
            &opened.connection,
            &crate::storage::repository::load_snapshot(&opened.connection, &opened.manifest)
                .unwrap()
                .tables[0]
                .id,
        )
        .unwrap();
        let field = field_repository::create_field(
            &mut opened.connection,
            &table.table_id,
            "文件",
            "file",
            json!({}),
            None,
        )
        .unwrap();
        let title = table
            .fields
            .into_iter()
            .find(|field| field.is_title)
            .unwrap();
        let record = record_repository::create_record(
            &mut opened.connection,
            &table.table_id,
            HashMap::from([(title.id, json!("附件记录"))]),
        )
        .unwrap();
        opened.connection.execute_batch("CREATE TRIGGER fail_attachment BEFORE INSERT ON attachments BEGIN SELECT RAISE(FAIL, 'injected db failure'); END;").unwrap();
        let source = root.with_extension("source.txt");
        fs::write(&source, "attachment-body").unwrap();
        let paths = ProjectPaths::existing(&root).unwrap();
        assert!(add_file(&paths, &mut opened.connection, &record, &field, &source).is_err());
        assert_eq!(fs::read_dir(&paths.attachments).unwrap().count(), 0);
        assert_eq!(
            opened
                .connection
                .query_row("SELECT COUNT(*) FROM attachments", [], |row| row
                    .get::<_, i64>(0))
                .unwrap(),
            0
        );
        let _ = fs::remove_file(source);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn copied_project_reopens_attachment_without_old_absolute_path() {
        let original = root("moved-original");
        let moved = root("moved-copy");
        let _ = fs::remove_dir_all(&original);
        let _ = fs::remove_dir_all(&moved);
        create_project(&original, "附件").unwrap();
        let mut opened = open_project(&original).unwrap();
        let table = field_repository::load_table_data(
            &opened.connection,
            &crate::storage::repository::load_snapshot(&opened.connection, &opened.manifest)
                .unwrap()
                .tables[0]
                .id,
        )
        .unwrap();
        let field = field_repository::create_field(
            &mut opened.connection,
            &table.table_id,
            "文件",
            "file",
            json!({}),
            None,
        )
        .unwrap();
        let title = table
            .fields
            .into_iter()
            .find(|field| field.is_title)
            .unwrap();
        let record = record_repository::create_record(
            &mut opened.connection,
            &table.table_id,
            HashMap::from([(title.id, json!("附件记录"))]),
        )
        .unwrap();
        let source = original.with_extension("source.txt");
        fs::write(&source, "attachment-body").unwrap();
        let paths = ProjectPaths::existing(&original).unwrap();
        let attachment =
            add_file(&paths, &mut opened.connection, &record, &field, &source).unwrap();
        drop(opened);
        fs::rename(&original, &moved).unwrap();
        let reopened = open_project(&moved).unwrap();
        let moved_paths = ProjectPaths::existing(&moved).unwrap();
        assert_eq!(
            fs::read(resolve_path(&moved_paths, &attachment.id, &reopened.connection).unwrap())
                .unwrap(),
            b"attachment-body"
        );
        assert!(!attachment
            .relative_path
            .contains(original.to_string_lossy().as_ref()));
        let _ = fs::remove_file(source);
        fs::remove_dir_all(moved).unwrap();
    }
}

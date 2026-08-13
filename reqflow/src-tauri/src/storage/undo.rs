use rusqlite::Connection;

use super::error::{StorageError, StorageErrorCode};
use super::field_models::{FieldBackup, OptionBackup};
use super::field_repository;
use super::record_repository::{self, BatchBackup, BoardMoveBackup, RecordBackup};
use super::repository;
use super::table_backup::{self, DeletedTable};

#[derive(Debug, Clone, PartialEq)]
pub enum UndoAction {
    DeleteTable {
        table_id: String,
    },
    RestoreTable {
        table: DeletedTable,
    },
    DeleteField {
        field_id: String,
    },
    RestoreField {
        backup: FieldBackup,
    },
    DeleteOption {
        option_id: String,
    },
    RestoreOption {
        backup: OptionBackup,
    },
    DeleteRecord {
        record_id: String,
    },
    RestoreRecord {
        backup: RecordBackup,
    },
    RestoreBatch {
        backup: BatchBackup,
    },
    RestoreBoardMove {
        backup: BoardMoveBackup,
    },
}

#[derive(Default)]
pub struct UndoStack {
    entries: Vec<UndoAction>,
}

impl UndoStack {
    pub const CAPACITY: usize = 50;

    pub fn push(&mut self, action: UndoAction) {
        if self.entries.len() == Self::CAPACITY {
            self.entries.remove(0);
        }
        self.entries.push(action);
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }

    pub fn undo(&mut self, connection: &mut Connection) -> Result<String, StorageError> {
        let Some(action) = self.entries.pop() else {
            return Err(StorageError::new(
                StorageErrorCode::UndoUnavailable,
                "当前会话没有可撤销的操作",
                false,
            ));
        };
        let result = match &action {
            UndoAction::DeleteTable { table_id } => {
                repository::delete_table(connection, table_id).map(|_| "已撤销新建表".to_string())
            }
            UndoAction::RestoreTable { table } => {
                table_backup::restore_table(connection, table).map(|()| "已撤销删除表".to_string())
            }
            UndoAction::DeleteField { field_id } => {
                field_repository::delete_field(connection, field_id)
                    .map(|_| "已撤销新建字段".to_string())
            }
            UndoAction::RestoreField { backup } => {
                field_repository::restore_field(connection, backup)
                    .map(|()| "已撤销字段变更".to_string())
            }
            UndoAction::DeleteOption { option_id } => {
                field_repository::delete_option(connection, option_id, "clear", None)
                    .map(|_| "已撤销新建选项".to_string())
            }
            UndoAction::RestoreOption { backup } => {
                field_repository::restore_option(connection, backup)
                    .map(|()| "已撤销选项变更".to_string())
            }
            UndoAction::DeleteRecord { record_id } => {
                record_repository::delete_record(connection, record_id)
                    .map(|_| "已撤销新建记录".to_string())
            }
            UndoAction::RestoreRecord { backup } => {
                record_repository::restore_record(connection, backup)
                    .map(|()| "已撤销记录变更".to_string())
            }
            UndoAction::RestoreBatch { backup } => {
                record_repository::restore_batch_mutation(connection, backup)
                    .map(|()| "已撤销批量操作".to_string())
            }
            UndoAction::RestoreBoardMove { backup } => {
                record_repository::restore_board_move(connection, backup)
                    .map(|()| "已撤销看板移动".to_string())
            }
        };
        if result.is_err() {
            self.entries.push(action);
        }
        result
    }

    pub fn restore_deleted_table(
        &mut self,
        connection: &mut Connection,
        table_id: &str,
    ) -> Result<(String, String), StorageError> {
        let Some(position) = self.entries.iter().rposition(|action| {
            matches!(action, UndoAction::RestoreTable { table } if table.table_id() == table_id)
        }) else {
            return Err(StorageError::new(
                StorageErrorCode::UndoUnavailable,
                "找不到要恢复的已删除表",
                false,
            ));
        };
        let action = self.entries.remove(position);
        let result = match &action {
            UndoAction::RestoreTable { table } => {
                let transaction = connection.transaction()?;
                let current_updated_at: String = transaction.query_row(
                    "SELECT updated_at FROM project_meta WHERE id = 'project'",
                    [],
                    |row| row.get(0),
                )?;
                table_backup::restore_table_in_transaction(&transaction, table)?;
                if current_updated_at == table.delete_updated_at() {
                    transaction.execute(
                        "UPDATE project_meta SET updated_at = ?1 WHERE id = 'project'",
                        [table.project_updated_at()],
                    )?;
                }
                transaction.commit()?;
                Ok((
                    "已恢复删除的表".to_string(),
                    table.project_updated_at().to_string(),
                ))
            }
            _ => unreachable!("仅匹配恢复表操作"),
        };
        if result.is_err() {
            self.entries.insert(position, action);
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::{UndoAction, UndoStack};
    use crate::storage::connection::ProjectManifest;
    use crate::storage::migrations::{apply_pending_migrations, configure_connection};
    use crate::storage::repository::{create_table, initialize_blank_project, load_snapshot};
    use crate::storage::table_backup;

    #[test]
    fn keeps_only_the_latest_fifty_actions_and_clears_on_close() {
        let mut stack = UndoStack::default();
        for index in 0..55 {
            stack.push(UndoAction::DeleteTable {
                table_id: index.to_string(),
            });
        }
        assert_eq!(stack.entries.len(), 50);
        stack.clear();
        assert_eq!(stack.entries.len(), 0);
    }

    #[test]
    fn target_restore_keeps_newer_undo_action_and_preserves_newer_project_timestamp() {
        let mut connection = rusqlite::Connection::open_in_memory().expect("database");
        configure_connection(&connection).expect("configure");
        apply_pending_migrations(&mut connection, None).expect("migrate");
        let manifest = ProjectManifest {
            id: "project".into(),
            name: "测试项目".into(),
            format_version: 1,
            created_at: "1".into(),
            updated_at: "1".into(),
        };
        initialize_blank_project(&mut connection, &manifest).expect("blank project");
        let deleted_table = create_table(&mut connection, "要恢复的表").expect("deleted table");
        let backup =
            table_backup::delete_table(&mut connection, &deleted_table.id).expect("delete table");
        let newer_table = create_table(&mut connection, "后续新建表").expect("newer table");
        connection
            .execute(
                "UPDATE project_meta SET updated_at = 'newer-operation' WHERE id = 'project'",
                [],
            )
            .expect("newer timestamp");
        let mut stack = UndoStack::default();
        stack.push(UndoAction::RestoreTable { table: backup });
        stack.push(UndoAction::DeleteTable {
            table_id: newer_table.id.clone(),
        });

        stack
            .restore_deleted_table(&mut connection, &deleted_table.id)
            .expect("target restore");

        let snapshot = load_snapshot(&connection, &manifest).expect("snapshot");
        assert!(snapshot
            .tables
            .iter()
            .any(|table| table.id == deleted_table.id));
        assert!(snapshot
            .tables
            .iter()
            .any(|table| table.id == newer_table.id));
        assert!(
            matches!(stack.entries.last(), Some(UndoAction::DeleteTable { table_id }) if table_id == &newer_table.id)
        );
        let updated_at: String = connection
            .query_row(
                "SELECT updated_at FROM project_meta WHERE id = 'project'",
                [],
                |row| row.get(0),
            )
            .expect("updated_at");
        assert_eq!(updated_at, "newer-operation");
    }
}

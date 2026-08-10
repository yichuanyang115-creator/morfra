use rusqlite::Connection;

use super::error::{StorageError, StorageErrorCode};
use super::field_models::{FieldBackup, FieldGroupBackup, OptionBackup};
use super::field_repository;
use super::record_repository::{self, RecordBackup};
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
    DeleteGroup {
        group_id: String,
    },
    RestoreGroup {
        backup: FieldGroupBackup,
    },
    RenameGroup {
        group_id: String,
        previous_name: String,
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
            UndoAction::DeleteGroup { group_id } => {
                field_repository::delete_group(connection, group_id)
                    .map(|_| "已撤销新建字段组".to_string())
            }
            UndoAction::RestoreGroup { backup } => {
                field_repository::restore_group(connection, backup)
                    .map(|()| "已撤销字段组变更".to_string())
            }
            UndoAction::RenameGroup {
                group_id,
                previous_name,
            } => field_repository::restore_group_name(connection, group_id, previous_name)
                .map(|()| "已撤销字段组重命名".to_string()),
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
        };
        if result.is_err() {
            self.entries.push(action);
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::{UndoAction, UndoStack};

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
}

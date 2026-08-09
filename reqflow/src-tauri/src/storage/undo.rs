use rusqlite::Connection;

use super::error::{StorageError, StorageErrorCode};
use super::repository;
use super::table_backup::{self, DeletedTable};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UndoAction {
    DeleteTable { table_id: String },
    RestoreTable { table: DeletedTable },
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

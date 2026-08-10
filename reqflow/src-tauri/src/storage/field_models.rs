#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldRow {
    pub id: String,
    pub table_id: String,
    pub group_id: Option<String>,
    pub name: String,
    pub field_type: String,
    pub is_title: i64,
    pub position: i64,
    pub config_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldGroupRow {
    pub id: String,
    pub table_id: String,
    pub name: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldOptionRow {
    pub id: String,
    pub field_id: String,
    pub name: String,
    pub color: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CellValueRow {
    pub record_id: String,
    pub field_id: String,
    pub value_json: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MultiSelectValueRow {
    pub record_id: String,
    pub field_id: String,
    pub option_id: String,
    pub position: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ViewConfigRow {
    pub view_id: String,
    pub version: i64,
    pub config_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldBackup {
    pub field: FieldRow,
    pub options: Vec<FieldOptionRow>,
    pub values: Vec<CellValueRow>,
    pub multi_values: Vec<MultiSelectValueRow>,
    pub view_configs: Vec<ViewConfigRow>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldGroupBackup {
    pub group: FieldGroupRow,
    pub member_fields: Vec<(String, Option<String>)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OptionBackup {
    pub option: FieldOptionRow,
    pub values: Vec<CellValueRow>,
    pub multi_values: Vec<MultiSelectValueRow>,
    pub view_configs: Vec<ViewConfigRow>,
}

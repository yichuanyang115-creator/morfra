CREATE TABLE table_configs (
    table_id TEXT PRIMARY KEY REFERENCES data_tables(id) ON DELETE CASCADE,
    detail_field_ids_json TEXT NOT NULL CHECK (json_valid(detail_field_ids_json)),
    updated_at TEXT NOT NULL
);

INSERT INTO table_configs (table_id, detail_field_ids_json, updated_at)
SELECT id, '[]', updated_at FROM data_tables;

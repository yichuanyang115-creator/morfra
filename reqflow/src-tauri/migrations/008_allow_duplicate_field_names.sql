-- Field identity is the stable field ID, not its display name. Rebuild the
-- SQLite table to remove the historical UNIQUE(table_id, name) constraint.
DROP INDEX IF EXISTS fields_table_position;
DROP INDEX IF EXISTS fields_one_title_per_table;

ALTER TABLE fields RENAME TO fields_pre_duplicate_names;

CREATE TABLE fields (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES field_groups(id) ON DELETE SET NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    field_type TEXT NOT NULL,
    is_title INTEGER NOT NULL DEFAULT 0 CHECK (is_title IN (0, 1)),
    position INTEGER NOT NULL CHECK (position >= 0),
    config_json TEXT NOT NULL CHECK (json_valid(config_json)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(table_id, position)
);

INSERT INTO fields (id, table_id, group_id, name, field_type, is_title, position, config_json, created_at, updated_at)
SELECT id, table_id, group_id, name, field_type, is_title, position, config_json, created_at, updated_at
FROM fields_pre_duplicate_names;

DROP TABLE fields_pre_duplicate_names;

CREATE UNIQUE INDEX fields_one_title_per_table
    ON fields(table_id)
    WHERE is_title = 1;
CREATE INDEX fields_table_position ON fields(table_id, position);

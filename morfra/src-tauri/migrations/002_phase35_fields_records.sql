DROP INDEX IF EXISTS fields_table_position;
DROP INDEX IF EXISTS fields_one_title_per_table;
DROP INDEX IF EXISTS cell_values_field_value;

ALTER TABLE cell_values RENAME TO cell_values_v1;
ALTER TABLE fields RENAME TO fields_v1;

CREATE TABLE field_groups (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    position INTEGER NOT NULL CHECK (position >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(table_id, name),
    UNIQUE(table_id, position)
);

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
    UNIQUE(table_id, name),
    UNIQUE(table_id, position)
);

CREATE UNIQUE INDEX fields_one_title_per_table
    ON fields(table_id)
    WHERE is_title = 1;

INSERT INTO fields (id, table_id, group_id, name, field_type, is_title, position, config_json, created_at, updated_at)
SELECT id, table_id, NULL, name, field_type, is_title, position, config_json, created_at, updated_at
FROM fields_v1;

ALTER TABLE records ADD COLUMN auto_number INTEGER NOT NULL DEFAULT 0;
UPDATE records SET auto_number = position + 1 WHERE auto_number = 0;
CREATE UNIQUE INDEX records_table_auto_number ON records(table_id, auto_number);

CREATE TABLE field_options (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    color TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(field_id, name),
    UNIQUE(field_id, position)
);

CREATE TABLE multi_select_values (
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL REFERENCES field_options(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY(record_id, field_id, option_id)
);

CREATE INDEX fields_table_position ON fields(table_id, position);
CREATE INDEX field_groups_table_position ON field_groups(table_id, position);
CREATE INDEX field_options_field_position ON field_options(field_id, position);
CREATE INDEX multi_select_values_record_field ON multi_select_values(record_id, field_id, position);

CREATE TABLE cell_values (
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    value_json TEXT NOT NULL CHECK (json_valid(value_json)),
    updated_at TEXT NOT NULL,
    PRIMARY KEY(record_id, field_id)
);

INSERT INTO cell_values (record_id, field_id, value_json, updated_at)
SELECT record_id, field_id, value_json, updated_at FROM cell_values_v1;

CREATE INDEX cell_values_field_value ON cell_values(field_id, value_json);

DROP TABLE cell_values_v1;
DROP TABLE fields_v1;

CREATE TABLE project_meta (
    id TEXT PRIMARY KEY CHECK (id = 'project'),
    project_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    format_version INTEGER NOT NULL CHECK (format_version = 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE data_tables (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES project_meta(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    position INTEGER NOT NULL CHECK (position >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, name),
    UNIQUE(project_id, position)
);

CREATE TABLE views (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    view_type TEXT NOT NULL CHECK (view_type IN ('table', 'board')),
    position INTEGER NOT NULL CHECK (position >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(table_id, name),
    UNIQUE(table_id, position)
);

CREATE TABLE view_configs (
    view_id TEXT PRIMARY KEY REFERENCES views(id) ON DELETE CASCADE,
    version INTEGER NOT NULL CHECK (version = 1),
    config_json TEXT NOT NULL CHECK (json_valid(config_json)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE fields (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    field_type TEXT NOT NULL CHECK (field_type = 'text'),
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

CREATE TABLE records (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(table_id, position)
);

CREATE TABLE cell_values (
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    value_json TEXT NOT NULL CHECK (json_valid(value_json)),
    updated_at TEXT NOT NULL,
    PRIMARY KEY(record_id, field_id)
);

CREATE INDEX data_tables_project_position ON data_tables(project_id, position);
CREATE INDEX views_table_position ON views(table_id, position);
CREATE INDEX fields_table_position ON fields(table_id, position);
CREATE INDEX records_table_position ON records(table_id, position);
CREATE INDEX cell_values_field_value ON cell_values(field_id, value_json);

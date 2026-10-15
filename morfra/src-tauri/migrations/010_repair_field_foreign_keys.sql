-- Migration 008 rebuilt `fields` to remove the display-name uniqueness
-- constraint. SQLite consequently left the dependent foreign keys pointing at
-- the temporary table name. Rebuild only those dependent tables so their data
-- is preserved while their foreign keys target the current `fields` table.
ALTER TABLE field_options RENAME TO field_options_pre_field_fk_repair;
ALTER TABLE multi_select_values RENAME TO multi_select_values_pre_field_fk_repair;
ALTER TABLE cell_values RENAME TO cell_values_pre_field_fk_repair;
ALTER TABLE table_configs RENAME TO table_configs_pre_field_fk_repair;
ALTER TABLE activity_comments RENAME TO activity_comments_pre_field_fk_repair;
ALTER TABLE activity_events RENAME TO activity_events_pre_field_fk_repair;
ALTER TABLE attachments RENAME TO attachments_pre_field_fk_repair;

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

CREATE TABLE cell_values (
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    value_json TEXT NOT NULL CHECK (json_valid(value_json)),
    updated_at TEXT NOT NULL,
    PRIMARY KEY(record_id, field_id)
);

CREATE TABLE table_configs (
    table_id TEXT PRIMARY KEY REFERENCES data_tables(id) ON DELETE CASCADE,
    detail_field_ids_json TEXT NOT NULL CHECK (json_valid(detail_field_ids_json)),
    updated_at TEXT NOT NULL,
    activity_field_id TEXT REFERENCES fields(id) ON DELETE SET NULL,
    activity_tab_enabled INTEGER NOT NULL DEFAULT 0 CHECK (activity_tab_enabled IN (0, 1)),
    detail_tabs_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(detail_tabs_json))
);

CREATE TABLE activity_events (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_id TEXT REFERENCES fields(id) ON DELETE SET NULL,
    field_name_snapshot TEXT NOT NULL,
    from_value_snapshot TEXT,
    to_value_snapshot TEXT,
    occurred_at TEXT NOT NULL,
    note TEXT
);

CREATE TABLE activity_comments (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES activity_events(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    relative_path TEXT NOT NULL UNIQUE CHECK (
        relative_path NOT LIKE '/%' AND
        instr(relative_path, '..') = 0 AND
        instr(relative_path, '\\') = 0
    ),
    original_name TEXT NOT NULL CHECK (length(trim(original_name)) > 0),
    media_type TEXT,
    byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
    created_at TEXT NOT NULL
);

INSERT INTO field_options SELECT * FROM field_options_pre_field_fk_repair;
INSERT INTO multi_select_values SELECT * FROM multi_select_values_pre_field_fk_repair;
INSERT INTO cell_values SELECT * FROM cell_values_pre_field_fk_repair;
INSERT INTO table_configs SELECT * FROM table_configs_pre_field_fk_repair;
INSERT INTO activity_events SELECT * FROM activity_events_pre_field_fk_repair;
INSERT INTO activity_comments SELECT * FROM activity_comments_pre_field_fk_repair;
INSERT INTO attachments SELECT * FROM attachments_pre_field_fk_repair;

DROP TABLE attachments_pre_field_fk_repair;
DROP TABLE activity_comments_pre_field_fk_repair;
DROP TABLE activity_events_pre_field_fk_repair;
DROP TABLE table_configs_pre_field_fk_repair;
DROP TABLE cell_values_pre_field_fk_repair;
DROP TABLE multi_select_values_pre_field_fk_repair;
DROP TABLE field_options_pre_field_fk_repair;

CREATE INDEX field_options_field_position ON field_options(field_id, position);
CREATE INDEX multi_select_values_record_field ON multi_select_values(record_id, field_id, position);
CREATE INDEX cell_values_field_value ON cell_values(field_id, value_json);
CREATE INDEX activity_events_record_occurred ON activity_events(record_id, occurred_at DESC);
CREATE INDEX activity_events_field ON activity_events(field_id);
CREATE INDEX attachments_record_field ON attachments(record_id, field_id, created_at);

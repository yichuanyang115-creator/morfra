ALTER TABLE table_configs ADD COLUMN activity_field_id TEXT REFERENCES fields(id) ON DELETE SET NULL;
ALTER TABLE table_configs ADD COLUMN activity_tab_enabled INTEGER NOT NULL DEFAULT 0 CHECK (activity_tab_enabled IN (0, 1));
ALTER TABLE table_configs ADD COLUMN detail_tabs_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(detail_tabs_json));

-- 需求管理模板沿用既有的四种非活动详情内容；它们只服务固定 Tab，
-- 不引入可编辑的通用 Tab 模型。
CREATE TABLE record_detail_contents (
    record_id TEXT PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE,
    body TEXT NOT NULL DEFAULT '',
    deliverables_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(deliverables_json)),
    tasks_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tasks_json)),
    acceptance_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(acceptance_json)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
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

CREATE INDEX activity_events_record_occurred ON activity_events(record_id, occurred_at DESC);
CREATE INDEX activity_events_field ON activity_events(field_id);

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

CREATE INDEX attachments_record_field ON attachments(record_id, field_id, created_at);

ALTER TABLE data_tables
ADD COLUMN icon TEXT NOT NULL DEFAULT 'grid'
CHECK (icon IN ('grid', 'list', 'board', 'calendar', 'document', 'checklist'));

ALTER TABLE data_tables
ADD COLUMN emoji TEXT NOT NULL DEFAULT '📋'
CHECK (length(trim(emoji)) > 0 AND length(emoji) <= 16);

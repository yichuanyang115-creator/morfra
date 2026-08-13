DROP INDEX IF EXISTS fields_table_position;
DROP INDEX IF EXISTS fields_one_title_per_table;

UPDATE view_configs AS vc
SET config_json = json_set(
      json_remove(vc.config_json, '$.groupOrder', '$.collapsedGroupIds'),
      '$.fieldIds',
      json(COALESCE((
        SELECT json_group_array(field_id)
        FROM (
          SELECT field_id
          FROM (
            SELECT visible.value AS field_id,
                   field.is_title AS is_title,
                   COALESCE((
                     SELECT CAST(group_position.key AS INTEGER)
                     FROM json_each(vc.config_json, '$.groupOrder') AS group_position
                     WHERE group_position.value = COALESCE(field.group_id, 'ungrouped')
                   ), 100000) AS group_position,
                   CAST(visible.key AS INTEGER) AS field_position
            FROM json_each(vc.config_json, '$.fieldIds') AS visible
            JOIN fields AS field ON field.id = visible.value
          )
          ORDER BY is_title DESC, group_position, field_position
        )
      ), '[]'))
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE json_type(vc.config_json, '$.groupOrder') IS NOT NULL
   OR json_type(vc.config_json, '$.collapsedGroupIds') IS NOT NULL;

ALTER TABLE fields RENAME TO fields_with_groups;

CREATE TABLE fields (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    field_type TEXT NOT NULL,
    is_title INTEGER NOT NULL DEFAULT 0 CHECK (is_title IN (0, 1)),
    position INTEGER NOT NULL CHECK (position >= 0),
    config_json TEXT NOT NULL CHECK (json_valid(config_json)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(table_id, position)
);

INSERT INTO fields (id, table_id, name, field_type, is_title, position, config_json, created_at, updated_at)
SELECT f.id, f.table_id, f.name, f.field_type, f.is_title,
       ROW_NUMBER() OVER (
         PARTITION BY f.table_id
         ORDER BY f.is_title DESC,
                  CASE WHEN f.group_id IS NULL THEN 1 ELSE 0 END,
                  COALESCE(g.position, 9223372036854775807),
                  f.position
       ) - 1,
       f.config_json, f.created_at, f.updated_at
FROM fields_with_groups f
LEFT JOIN field_groups g ON g.id = f.group_id;

DROP TABLE fields_with_groups;
DROP TABLE field_groups;

CREATE UNIQUE INDEX fields_one_title_per_table ON fields(table_id) WHERE is_title = 1;
CREATE INDEX fields_table_position ON fields(table_id, position);

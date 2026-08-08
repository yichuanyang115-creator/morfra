export type TableFieldType =
  | "text"
  | "number"
  | "percent"
  | "singleSelect"
  | "multiSelect"
  | "date"
  | "checkbox"
  | "attachment"
  | "computed";

export interface ActiveTableDescriptor {
  tableId: string;
  name: string;
}

export interface TableField {
  id: string;
  name: string;
  type: TableFieldType;
  options?: Array<{ id: string; label: string }>;
}

export interface TableRecord {
  id: string;
  values: Record<string, unknown>;
}

export interface TableSnapshot {
  tableId: string;
  name: string;
  schemaVersion: string;
  primaryTitleFieldId: string;
  fields: TableField[];
  records: TableRecord[];
  capturedAt: string;
}

export type TableEvent =
  | { type: "active-table-changed"; tableId: string | null }
  | { type: "table-data-changed"; tableId: string }
  | { type: "selection-changed"; tableId: string; recordIds: string[] }
  | { type: "table-deleted"; tableId: string };

/** 主产品提供给 AI Core 的唯一只读表数据端口。 */
export interface TableDataAdapter {
  getActiveTable(): ActiveTableDescriptor | null;
  getTableSnapshot(tableId: string): Promise<TableSnapshot>;
  getSelectedRecordIds(tableId: string): string[];
  subscribe(listener: (event: TableEvent) => void): () => void;
}

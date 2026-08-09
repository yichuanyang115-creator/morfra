import type {
  ActiveTableDescriptor,
  TableEvent,
  TableSnapshot,
} from "./tableSnapshot";

export type {
  ActiveTableDescriptor,
  TableCellValue,
  TableEvent,
  TableField,
  TableFieldOption,
  TableFieldType,
  TableRecord,
  TableSnapshot,
  TableAttachment,
} from "./tableSnapshot";

/** 主产品提供给 AI Core 的唯一只读表数据端口。 */
export interface TableDataAdapter {
  getActiveTable(): ActiveTableDescriptor | null;
  getTableSnapshot(tableId: string): Promise<TableSnapshot>;
  getSelectedRecordIds(tableId: string): string[];
  subscribe(listener: (event: TableEvent) => void): () => void;
}

import type {
  ActiveTableDescriptor,
  TableDataAdapter,
  TableEvent,
  TableSnapshot,
} from "../lib/ai/tableDataAdapter";

const CAPTURED_AT = "2026-08-08T08:00:00.000Z";

export const AI_EVALUATION_TABLES: readonly TableSnapshot[] = [
  {
    tableId: "table-delivery",
    name: "产品交付",
    schemaVersion: "delivery-v1",
    primaryTitleFieldId: "title",
    fields: [
      { id: "title", name: "事项", type: "text" },
      {
        id: "status",
        name: "状态",
        type: "singleSelect",
        options: [
          { id: "todo", label: "待处理" },
          { id: "doing", label: "进行中" },
          { id: "done", label: "已完成" },
        ],
      },
      { id: "effort", name: "工作量", type: "number" },
      { id: "progress", name: "进度", type: "percent" },
      { id: "dueDate", name: "截止日期", type: "date" },
    ],
    records: [
      { id: "delivery-1", values: { title: "领域契约", status: "done", effort: 3, progress: 100, dueDate: "2026-08-08" } },
      { id: "delivery-2", values: { title: "本地持久化", status: "doing", effort: 5, progress: 60, dueDate: "2026-08-10" } },
      { id: "delivery-3", values: { title: "集成验证", status: "todo", effort: 8, progress: 0, dueDate: null } },
    ],
    capturedAt: CAPTURED_AT,
  },
  {
    tableId: "table-budget",
    name: "预算跟踪",
    schemaVersion: "budget-v1",
    primaryTitleFieldId: "item",
    fields: [
      { id: "item", name: "项目", type: "text" },
      { id: "amount", name: "金额", type: "number" },
      { id: "approved", name: "已批准", type: "checkbox" },
      {
        id: "category",
        name: "分类",
        type: "multiSelect",
        options: [
          { id: "software", label: "软件" },
          { id: "service", label: "服务" },
        ],
      },
    ],
    records: [
      { id: "budget-1", values: { item: "模型服务", amount: 1200, approved: true, category: ["service"] } },
      { id: "budget-2", values: { item: "测试工具", amount: 300, approved: false, category: ["software", "service"] } },
    ],
    capturedAt: CAPTURED_AT,
  },
] as const;

export interface EvaluationTableAdapterControls {
  adapter: TableDataAdapter;
  setActiveTable(tableId: string | null): void;
  setSelectedRecordIds(tableId: string, recordIds: string[]): void;
  emit(event: TableEvent): void;
}

function cloneSnapshot(snapshot: TableSnapshot): TableSnapshot {
  return structuredClone(snapshot);
}

export function createEvaluationTableAdapter(): EvaluationTableAdapterControls {
  const tables = new Map(AI_EVALUATION_TABLES.map((table) => [table.tableId, cloneSnapshot(table)]));
  const selections = new Map<string, string[]>();
  const listeners = new Set<(event: TableEvent) => void>();
  let activeTableId: string | null = AI_EVALUATION_TABLES[0]?.tableId ?? null;

  const emit = (event: TableEvent): void => {
    for (const listener of listeners) listener(structuredClone(event));
  };

  const adapter: TableDataAdapter = {
    getActiveTable(): ActiveTableDescriptor | null {
      if (activeTableId === null) return null;
      const table = tables.get(activeTableId);
      return table ? { tableId: table.tableId, name: table.name } : null;
    },
    async getTableSnapshot(tableId) {
      const table = tables.get(tableId);
      if (!table) throw new Error(`找不到表：${tableId}`);
      return cloneSnapshot(table);
    },
    getSelectedRecordIds(tableId) {
      return [...(selections.get(tableId) ?? [])];
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    adapter,
    setActiveTable(tableId) {
      if (tableId !== null && !tables.has(tableId)) throw new Error(`找不到表：${tableId}`);
      activeTableId = tableId;
      emit({ type: "active-table-changed", tableId });
    },
    setSelectedRecordIds(tableId, recordIds) {
      const table = tables.get(tableId);
      if (!table) throw new Error(`找不到表：${tableId}`);
      const validIds = new Set(table.records.map((record) => record.id));
      const selection = recordIds.filter((recordId) => validIds.has(recordId));
      selections.set(tableId, selection);
      emit({ type: "selection-changed", tableId, recordIds: selection });
    },
    emit,
  };
}

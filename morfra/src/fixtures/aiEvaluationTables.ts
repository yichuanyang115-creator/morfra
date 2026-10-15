import type {
  ActiveTableDescriptor,
  TableDataAdapter,
  TableEvent,
  TableSnapshot,
} from "../lib/ai/tableDataAdapter";
import { normalizeTableSnapshot } from "../lib/ai/tableSnapshot";

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
  {
    tableId: "table-empty",
    name: "空表",
    schemaVersion: "empty-v1",
    primaryTitleFieldId: "title",
    fields: [
      { id: "title", name: "事项", type: "text" },
      {
        id: "status",
        name: "状态",
        type: "singleSelect",
        options: [{ id: "todo", label: "待处理" }, { id: "done", label: "已完成" }],
      },
    ],
    records: [],
    capturedAt: CAPTURED_AT,
  },
  {
    tableId: "table-mixed",
    name: "混合字段",
    schemaVersion: "mixed-v1",
    primaryTitleFieldId: "title",
    fields: [
      { id: "title", name: "事项", type: "text" },
      { id: "amount", name: "金额", type: "number" },
      { id: "progress", name: "进度", type: "percent" },
      {
        id: "status",
        name: "状态",
        type: "singleSelect",
        options: [{ id: "todo", label: "待处理" }, { id: "done", label: "已完成" }],
      },
      {
        id: "tags",
        name: "标签",
        type: "multiSelect",
        options: [{ id: "alpha", label: "Alpha" }, { id: "beta", label: "Beta" }],
      },
      { id: "dueDate", name: "截止日期", type: "date" },
      { id: "checked", name: "已检查", type: "checkbox" },
      { id: "files", name: "附件", type: "attachment" },
      { id: "computed", name: "计算值", type: "computed" },
    ],
    records: [
      {
        id: "mixed-1",
        values: {
          title: "重复记录",
          amount: 10,
          progress: null,
          status: "todo",
          tags: ["alpha"],
          dueDate: null,
          checked: true,
          files: [{ id: "file-1", name: "说明.pdf", mimeType: "application/pdf" }],
          computed: 1,
        },
      },
      {
        id: "mixed-2",
        values: {
          title: "重复记录",
          amount: null,
          progress: 50,
          status: "done",
          tags: [],
          dueDate: "2026-08-09",
          checked: false,
          files: [],
          computed: 2,
        },
      },
    ],
    capturedAt: CAPTURED_AT,
  },
  {
    tableId: "table-same-name-a",
    name: "同名记录 A",
    schemaVersion: "same-a-v1",
    primaryTitleFieldId: "title",
    fields: [{ id: "title", name: "事项", type: "text" }, { id: "score", name: "分数", type: "number" }],
    records: [{ id: "same-a-1", values: { title: "重复记录", score: 10 } }],
    capturedAt: CAPTURED_AT,
  },
  {
    tableId: "table-same-name-b",
    name: "同名记录 B",
    schemaVersion: "same-b-v1",
    primaryTitleFieldId: "title",
    fields: [{ id: "title", name: "事项", type: "text" }, { id: "score", name: "分数", type: "number" }],
    records: [{ id: "same-b-1", values: { title: "重复记录", score: 99 } }],
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
  return normalizeTableSnapshot(snapshot);
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

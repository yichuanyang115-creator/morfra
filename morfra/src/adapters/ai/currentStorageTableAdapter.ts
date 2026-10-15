import { onTableDeleted } from "../../lib/tableLifecycleEvents";
import type { TableDataAdapter, TableEvent, TableField, TableFieldType, TableSnapshot } from "../../lib/ai/tableDataAdapter";
import { normalizeTableSnapshot } from "../../lib/ai/tableSnapshot";
import { currentProject, type ProjectState, useProjectStore } from "../../stores/projectStore";
import { useStorageSelectionStore } from "../../stores/storageSelectionStore";
import { useTableDataStore } from "../../stores/tableDataStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import type { AIHostActionResult, TableAttachment } from "../../lib/ai/tableDataAdapter";
import type { FieldSummary, RecordData, TableDataSnapshot, TableSummary } from "../../types/domain";

export interface StorageStore<State> {
  getState: () => State;
  subscribe: (listener: (state: State, previousState: State) => void) => () => void;
}

export interface CurrentStorageProjectState extends Pick<ProjectState, "projects" | "currentProjectId"> {}

export interface CurrentStorageWorkspaceState {
  activeTableByProject: Record<string, string>;
  setActiveTable: (projectId: string, tableId: string) => void;
}

export interface CurrentStorageTableDataState {
  dataByTable: Record<string, TableDataSnapshot | undefined>;
  load: (tableId: string) => Promise<TableDataSnapshot>;
}

export interface CurrentStorageSelectionState {
  selectedRecordByTable: Record<string, string | undefined>;
  selectedRecordIdsByTable: Record<string, string[] | undefined>;
  selectRecord: (tableId: string, recordId: string | null) => void;
}

export interface CurrentStorageTableAdapterDependencies {
  projectStore: StorageStore<CurrentStorageProjectState>;
  workspaceStore: StorageStore<CurrentStorageWorkspaceState>;
  tableDataStore: StorageStore<CurrentStorageTableDataState>;
  selectionStore: StorageStore<CurrentStorageSelectionState>;
  onTableDeleted?: (listener: (tableId: string) => void | Promise<void>) => () => void;
}

export interface CurrentStorageTableAdapter extends TableDataAdapter {
  dispose: () => void;
}

export interface CurrentStorageHostActions {
  openRecord: (input: { tableId: string; recordId: string }) => Promise<AIHostActionResult>;
  notifyGenerationCompleted: (input: { tableId: string; conversationId: string }) => void;
}

const defaultDependencies: CurrentStorageTableAdapterDependencies = {
  projectStore: useProjectStore,
  workspaceStore: useWorkspaceStore,
  tableDataStore: useTableDataStore,
  selectionStore: useStorageSelectionStore,
  onTableDeleted,
};

function currentStorageProject(dependencies: CurrentStorageTableAdapterDependencies) {
  return currentProject(dependencies.projectStore.getState() as ProjectState);
}

function activeTableFor(dependencies: CurrentStorageTableAdapterDependencies): TableSummary | null {
  const project = currentStorageProject(dependencies);
  if (!project?.storageSnapshot) return null;
  const tables = project.storageSnapshot.tables;
  const selectedId = dependencies.workspaceStore.getState().activeTableByProject[project.id];
  return tables.find((table) => table.id === selectedId) ?? tables[0] ?? null;
}

function tableFor(dependencies: CurrentStorageTableAdapterDependencies, tableId: string): TableSummary {
  const project = currentStorageProject(dependencies);
  const table = project?.storageSnapshot?.tables.find((candidate) => candidate.id === tableId);
  if (!table) throw new Error(`当前存储宿主没有表：${tableId}`);
  return table;
}

function mapFieldType(field: FieldSummary): TableFieldType {
  switch (field.fieldType) {
    case "number": return "number";
    case "progress": return "percent";
    case "select": return "singleSelect";
    case "multi_select": return "multiSelect";
    case "date":
    case "created_time":
    case "updated_time": return "date";
    case "checkbox": return "checkbox";
    case "image":
    case "file": return "attachment";
    case "auto_number": return "computed";
    case "text":
    case "link": return "text";
  }
}

function fieldFor(field: FieldSummary): TableField {
  const type = mapFieldType(field);
  return {
    id: field.id,
    name: field.name,
    type,
    ...(type === "singleSelect" || type === "multiSelect"
      ? { options: [...field.options].sort((left, right) => left.position - right.position).map((option) => ({ id: option.id, label: option.name })) }
      : {}),
  };
}

function scalarText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function valueFor(attachments: TableDataSnapshot["attachments"], record: RecordData, source: FieldSummary, field: TableField): unknown {
  if (source.fieldType === "auto_number") return record.autoNumber;
  if (source.fieldType === "created_time") return record.createdAt;
  if (source.fieldType === "updated_time") return record.updatedAt;
  if (source.fieldType === "image" || source.fieldType === "file") {
    return (attachments ?? []).filter((attachment) => attachment.recordId === record.id && attachment.fieldId === source.id).map((attachment): TableAttachment => ({ id: attachment.id, name: attachment.originalName, ...(attachment.mediaType ? { mimeType: attachment.mediaType } : {}) }));
  }
  const value = source.fieldType === "multi_select" ? record.multiSelectValues[source.id] : record.values[source.id];

  if (field.type === "text") {
    if (source.fieldType === "multi_select" && Array.isArray(value)) return value.join(", ");
    return scalarText(value);
  }
  if (field.type === "number" || field.type === "percent") return typeof value === "number" && Number.isFinite(value) ? value : null;
  if (field.type === "singleSelect") return typeof value === "string" && field.options?.some((option) => option.id === value) ? value : null;
  if (field.type === "multiSelect") return Array.isArray(value) && value.every((id): id is string => typeof id === "string") && value.every((id) => field.options?.some((option) => option.id === id)) ? value : source.fieldType === "multi_select" ? [] : null;
  if (field.type === "date") return typeof value === "string" ? value : null;
  if (field.type === "checkbox") return typeof value === "boolean" ? value : null;
  if (field.type === "attachment") return [];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
}

function snapshotFor(dependencies: CurrentStorageTableAdapterDependencies, tableId: string, data: TableDataSnapshot): TableSnapshot {
  const project = currentStorageProject(dependencies);
  const table = tableFor(dependencies, tableId);
  const sources = [...data.fields].sort((left, right) => left.position - right.position);
  const fields = sources.map(fieldFor);
  return normalizeTableSnapshot({
    tableId,
    name: data.tableName ?? table.name,
    schemaVersion: `storage-${project?.storageSnapshot?.manifest.formatVersion ?? 1}`,
    primaryTitleFieldId: data.titleFieldId ?? table.titleFieldId,
    fields,
    records: [...data.records].sort((left, right) => left.position - right.position).map((record) => ({
      id: record.id,
      values: Object.fromEntries(sources.map((source, index) => [source.id, valueFor(data.attachments, record, source, fields[index])] as const)),
    })),
    capturedAt: new Date().toISOString(),
  });
}

export function createCurrentStorageTableAdapter(
  dependencies: CurrentStorageTableAdapterDependencies = defaultDependencies,
): CurrentStorageTableAdapter {
  const listeners = new Set<(event: TableEvent) => void>();
  const emit = (event: TableEvent): void => { for (const listener of listeners) listener(structuredClone(event)); };
  const projectUnsubscribe = dependencies.projectStore.subscribe((state, previous) => {
    if (state.currentProjectId !== previous.currentProjectId) {
      emit({ type: "active-table-changed", tableId: activeTableFor(dependencies)?.id ?? null });
    } else if (state.projects !== previous.projects) {
      const active = activeTableFor(dependencies);
      if (active) emit({ type: "table-data-changed", tableId: active.id });
    }
  });
  const workspaceUnsubscribe = dependencies.workspaceStore.subscribe((state, previous) => {
    if (state.activeTableByProject === previous.activeTableByProject) return;
    const active = activeTableFor(dependencies);
    emit({ type: "active-table-changed", tableId: active?.id ?? null });
  });
  const dataUnsubscribe = dependencies.tableDataStore.subscribe((state, previous) => {
    const tableIds = new Set([...Object.keys(state.dataByTable), ...Object.keys(previous.dataByTable)]);
    for (const tableId of tableIds) {
      if (state.dataByTable[tableId] !== previous.dataByTable[tableId]) emit({ type: "table-data-changed", tableId });
    }
  });
  const selectionUnsubscribe = dependencies.selectionStore.subscribe((state, previous) => {
    if (state.selectedRecordIdsByTable === previous.selectedRecordIdsByTable) return;
    const active = activeTableFor(dependencies);
    if (!active) return;
    const selected = state.selectedRecordIdsByTable[active.id] ?? [];
    emit({ type: "selection-changed", tableId: active.id, recordIds: selected });
  });
  const deletionUnsubscribe = dependencies.onTableDeleted?.((tableId) => emit({ type: "table-deleted", tableId }));

  return {
    getActiveTable() {
      const table = activeTableFor(dependencies);
      return table ? { tableId: table.id, name: table.name } : null;
    },
    async getTableSnapshot(tableId) {
      tableFor(dependencies, tableId);
      const cached = dependencies.tableDataStore.getState().dataByTable[tableId];
      const data = cached ?? await dependencies.tableDataStore.getState().load(tableId);
      if (data.tableId !== tableId) throw new Error(`表快照身份不匹配：期望 ${tableId}，实际 ${data.tableId}`);
      return snapshotFor(dependencies, tableId, data);
    },
    getSelectedRecordIds(tableId) {
      const selected = dependencies.selectionStore.getState().selectedRecordIdsByTable[tableId] ?? [];
      const records = dependencies.tableDataStore.getState().dataByTable[tableId]?.records;
      const existing = new Set(records?.map((record) => record.id) ?? []);
      return selected.filter((recordId) => existing.has(recordId));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      projectUnsubscribe();
      workspaceUnsubscribe();
      dataUnsubscribe();
      selectionUnsubscribe();
      deletionUnsubscribe?.();
      listeners.clear();
    },
  };
}

export function createCurrentStorageHostActions(
  dependencies: Pick<CurrentStorageTableAdapterDependencies, "projectStore" | "workspaceStore" | "selectionStore" | "tableDataStore"> = defaultDependencies,
  onRecordOpened: () => void = () => undefined,
): CurrentStorageHostActions {
  return {
    openRecord: async ({ tableId, recordId }) => {
      const project = currentStorageProject(dependencies as CurrentStorageTableAdapterDependencies);
      if (!project?.storageSnapshot?.tables.some((table) => table.id === tableId)) return { ok: false, code: "table-not-found", message: "目标表不存在，无法打开引用。", retryable: false };
      let data = dependencies.tableDataStore.getState().dataByTable[tableId];
      try { if (!data) data = await dependencies.tableDataStore.getState().load(tableId); } catch { return { ok: false, code: "host-unavailable", message: "表数据暂时不可用，请重试。", retryable: true }; }
      if (data.tableId !== tableId) return { ok: false, code: "host-unavailable", message: "表数据暂时不可用，请重试。", retryable: true };
      if (!data.records.some((record) => record.id === recordId)) return { ok: false, code: "record-not-found", message: "这条记录已不存在，请刷新后重试。", retryable: true };
      dependencies.workspaceStore.getState().setActiveTable(project.id, tableId);
      dependencies.selectionStore.getState().selectRecord(tableId, recordId);
      onRecordOpened();
      return { ok: true };
    },
    notifyGenerationCompleted: () => {
      window.dispatchEvent(new CustomEvent("ai-generation-completed"));
    },
  };
}

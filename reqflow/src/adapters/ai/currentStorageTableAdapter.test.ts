import { describe, expect, it, vi } from "vitest";
import {
  createCurrentStorageHostActions,
  createCurrentStorageTableAdapter,
  type StorageStore,
} from "./currentStorageTableAdapter";
import type { Project } from "../../types/models";
import type { TableDataSnapshot } from "../../types/domain";
import { runIntegrationChecks } from "../../lib/ai/integrationChecks";

function createStore<State>(initial: State): StorageStore<State> & { set: (state: State) => void } {
  let state = initial;
  const listeners = new Set<(state: State, previous: State) => void>();
  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    set(next) { const previous = state; state = next; listeners.forEach((listener) => listener(next, previous)); },
  };
}

const project: Project = {
  id: "project-storage", name: "真实本地项目", sources: [], storageSnapshot: {
    manifest: { id: "project-storage", name: "真实本地项目", formatVersion: 3, createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z" },
    tables: [{ id: "table-delivery", name: "交付表", position: 0, titleFieldId: "name", recordCount: 1, views: [] }],
  },
};

const tableData: TableDataSnapshot = {
  tableId: "table-delivery", groups: [],
  fields: [
    { id: "name", tableId: "table-delivery", groupId: null, name: "Name", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
    { id: "stage", tableId: "table-delivery", groupId: null, name: "Stage", fieldType: "select", isTitle: false, position: 1, config: {}, options: [{ id: "done", fieldId: "stage", name: "完成", color: "green", position: 0 }] },
    { id: "files", tableId: "table-delivery", groupId: null, name: "附件", fieldType: "file", isTitle: false, position: 2, config: {}, options: [] },
    { id: "tags", tableId: "table-delivery", groupId: null, name: "标签", fieldType: "multi_select", isTitle: false, position: 3, config: {}, options: [{ id: "tag-a", fieldId: "tags", name: "A", color: "blue", position: 0 }] },
    { id: "created", tableId: "table-delivery", groupId: null, name: "创建时间", fieldType: "created_time", isTitle: false, position: 4, config: {}, options: [] },
  ],
  records: [{ id: "record-a", tableId: "table-delivery", position: 0, autoNumber: 1, createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z", values: { name: "验收接入", stage: "done", files: "/private/secret.pdf" }, multiSelectValues: { tags: ["tag-a"] } }],
};

function dependencies() {
  const projectStore = createStore({ projects: [project], currentProjectId: project.id });
  const workspaceStore = createStore({ activeTableByProject: { [project.id]: tableData.tableId }, setActiveTable: vi.fn() });
  const tableDataStore = createStore({ dataByTable: { [tableData.tableId]: tableData }, load: vi.fn(async () => tableData) });
  const selectionStore = createStore({ selectedRecordByTable: { [tableData.tableId]: "record-a" }, selectRecord: vi.fn() });
  return { projectStore, workspaceStore, tableDataStore, selectionStore };
}

describe("currentStorageTableAdapter 真实 Tauri 宿主映射", () => {
  it("通过运行时 tableId、快照、主标题、选择和订阅契约检查", async () => {
    const deps = dependencies();
    const adapter = createCurrentStorageTableAdapter(deps);

    const report = await runIntegrationChecks(adapter, {
      tableId: "table-delivery",
      eventProbe: () => deps.selectionStore.set({ ...deps.selectionStore.getState(), selectedRecordByTable: {} }),
      afterUnsubscribeProbe: () => deps.tableDataStore.set({ ...deps.tableDataStore.getState(), dataByTable: {} }),
    });

    expect(report.failures).toEqual([]);
    expect(report.checks.map((check) => check.id)).toEqual(["table-id", "snapshot-contract", "selection-range", "snapshot-consistency", "event-subscription"]);
    adapter.dispose();
  });

  it("以真实 tableId、字段和记录映射只读快照，附件不传路径或文件内容", async () => {
    const deps = dependencies();
    const adapter = createCurrentStorageTableAdapter(deps);
    const snapshot = await adapter.getTableSnapshot("table-delivery");

    expect(adapter.getActiveTable()).toEqual({ tableId: "table-delivery", name: "交付表" });
    expect(snapshot.primaryTitleFieldId).toBe("name");
    expect(snapshot.fields.map((field) => field.type)).toEqual(["text", "singleSelect", "attachment", "multiSelect", "date"]);
    expect(snapshot.records[0]).toEqual({ id: "record-a", values: { name: "验收接入", stage: "done", files: [], tags: ["tag-a"], created: "2026-08-10" } });
    expect(JSON.stringify(snapshot)).not.toContain("/private/secret.pdf");
    expect(adapter.getSelectedRecordIds("table-delivery")).toEqual(["record-a"]);
    adapter.dispose();
  });

  it("对活动表、数据、选择和删除发出事件，并在 dispose 后停止", () => {
    const deps = dependencies();
    let deletionListener: ((tableId: string) => void | Promise<void>) | undefined;
    const adapter = createCurrentStorageTableAdapter({ ...deps, onTableDeleted: (listener) => { deletionListener = listener; return () => { deletionListener = undefined; }; } });
    const listener = vi.fn();
    adapter.subscribe(listener);
    deps.tableDataStore.set({ ...deps.tableDataStore.getState(), dataByTable: { [tableData.tableId]: { ...tableData, records: [] } } });
    deps.selectionStore.set({ ...deps.selectionStore.getState(), selectedRecordByTable: {} });
    deletionListener?.("table-delivery");
    expect(listener.mock.calls.map(([event]) => event.type)).toEqual(["table-data-changed", "selection-changed", "table-deleted"]);
    adapter.dispose();
    deps.workspaceStore.set({ ...deps.workspaceStore.getState(), activeTableByProject: {} });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("表数据缓存被清空时也会通知面板刷新", () => {
    const deps = dependencies();
    const adapter = createCurrentStorageTableAdapter(deps);
    const listener = vi.fn();
    adapter.subscribe(listener);

    deps.tableDataStore.set({ ...deps.tableDataStore.getState(), dataByTable: {} });

    expect(listener).toHaveBeenCalledWith({ type: "table-data-changed", tableId: "table-delivery" });
    adapter.dispose();
  });

  it("引用跳转只切换真实表并选择真实记录", () => {
    const deps = dependencies();
    const opened = vi.fn();
    const actions = createCurrentStorageHostActions(deps, opened);

    actions.openRecord({ tableId: "table-delivery", recordId: "record-a" });
    actions.openRecord({ tableId: "unknown", recordId: "record-x" });

    expect(deps.workspaceStore.getState().setActiveTable).toHaveBeenCalledOnce();
    expect(deps.workspaceStore.getState().setActiveTable).toHaveBeenCalledWith("project-storage", "table-delivery");
    expect(deps.selectionStore.getState().selectRecord).toHaveBeenCalledOnce();
    expect(deps.selectionStore.getState().selectRecord).toHaveBeenCalledWith("table-delivery", "record-a");
    expect(opened).toHaveBeenCalledOnce();
  });
});

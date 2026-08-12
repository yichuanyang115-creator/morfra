import { describe, expect, it, vi } from "vitest";
import {
  createCurrentProjectHostActions,
  createCurrentProjectTableAdapter,
  type CurrentProjectUIState,
  type CurrentProjectStore,
} from "./currentProjectTableAdapter";
import type { Project } from "../../types/models";
import type { Attribute, Schema } from "../../types/schema";

function createTestStore<State>(initialState: State): CurrentProjectStore<State> & { set: (next: State) => void } {
  let state = initialState;
  const listeners = new Set<(next: State, previous: State) => void>();
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      const previous = state;
      state = next;
      for (const listener of listeners) listener(state, previous);
    },
  };
}

const project: Project = { id: "project-a", name: "需求项目", sources: [] };
const attribute: Attribute = {
  id: "priority",
  name: "优先级",
  type: "singleSelect",
  options: [{ id: "p0", label: "P0" }, { id: "p1", label: "P1" }],
  showOnBoard: true,
  showOnDetail: true,
};
const attachmentAttribute: Attribute = {
  id: "files",
  name: "附件",
  type: "attachment",
  showOnBoard: true,
  showOnDetail: true,
};
const schema: Schema = {
  version: 7,
  stageOptions: [{ id: "todo", label: "待处理", color: "#000", isTerminal: false }],
  attributes: [attribute, attachmentAttribute],
  tabs: [{ id: "body", name: "正文", renderer: "body", visible: true }],
  viewPreferences: { columnOrder: [], columnWidths: {}, frozenCount: 0, filters: [] },
};
const requirement = {
  id: "requirement-a",
  name: "接入准备",
  stage: "todo",
  createdAt: "2026-08-10T00:00:00.000Z",
  manualOrder: 0,
  body: "详情正文不应进入表格快照",
  attributeValues: {
    priority: "p0",
    files: [
      { id: "file-a", name: "合同.pdf", mimeType: "application/pdf", path: "/private/secret.pdf", content: "不要传" },
      { id: "unsafe", name: "坏数据", body: "正文不应传", content: "完整文件内容" },
      { path: "/private/without-metadata" },
    ],
  },
  deliverables: [],
  tasks: [],
  acceptance: [],
  tabRecords: [{ id: "tab-record-a", tabId: "body", fieldValues: { body: "Tab 正文不应进入快照" }, createdAt: "2026-08-10" }],
  transitions: [],
  comments: [],
};

function dependencies() {
  const projectStore = createTestStore({ projects: [project], currentProjectId: project.id });
  const requirementStore = createTestStore({ requirements: [requirement], loadedProjectId: project.id });
  const schemaStore = createTestStore({ schema, loadedProjectId: project.id });
  const selectRequirement = vi.fn();
  const uiStore = createTestStore<CurrentProjectUIState>({ selectedRequirementId: requirement.id, selectRequirement });
  return { projectStore, requirementStore, schemaStore, uiStore, selectRequirement };
}

describe("currentProjectTableAdapter 临时宿主映射", () => {
  it("用 Project.id/name、Schema 字段和 Requirement 表格值生成只读快照", async () => {
    const deps = dependencies();
    const adapter = createCurrentProjectTableAdapter(deps);

    expect(adapter.getActiveTable()).toEqual({ tableId: "project-a", name: "需求项目" });
    const snapshot = await adapter.getTableSnapshot("project-a");

    expect(snapshot.tableId).toBe("project-a");
    expect(snapshot.name).toBe("需求项目");
    expect(snapshot.primaryTitleFieldId).toBe("name");
    expect(snapshot.fields.map((field) => field.id)).toEqual(["name", "stage", "priority", "files"]);
    expect(snapshot.fields.find((field) => field.id === "stage")?.options).toEqual([{ id: "todo", label: "待处理" }]);
    expect(snapshot.records).toHaveLength(1);
    expect(snapshot.records[0]).toEqual({
      id: "requirement-a",
      values: {
        name: "接入准备",
        stage: "todo",
        priority: "p0",
        files: [
          { id: "file-a", name: "合同.pdf", mimeType: "application/pdf", url: undefined },
          { id: "unsafe", name: "坏数据", mimeType: undefined, url: undefined },
        ],
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain("详情正文不应进入表格快照");
    expect(JSON.stringify(snapshot)).not.toContain("Tab 正文不应进入快照");
    expect(JSON.stringify(snapshot)).not.toContain("/private/secret.pdf");
    expect(JSON.stringify(snapshot)).not.toContain("正文不应传");
    expect(JSON.stringify(snapshot)).not.toContain("完整文件内容");
    expect(JSON.stringify(snapshot)).not.toContain("without-metadata");
    expect(adapter.getSelectedRecordIds("project-a")).toEqual(["requirement-a"]);
    expect(await adapter.getTableSnapshot("project-a")).not.toBe(snapshot);

    await expect(adapter.getTableSnapshot("project-b")).rejects.toThrow("没有表");
    adapter.dispose();
  });

  it("监听当前表、Schema、记录和选择变化，并支持退订", () => {
    const deps = dependencies();
    const adapter = createCurrentProjectTableAdapter(deps);
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);

    deps.requirementStore.set({ requirements: [requirement], loadedProjectId: project.id });
    deps.schemaStore.set({ schema: { ...schema, version: 8 }, loadedProjectId: project.id });
    deps.uiStore.set({ selectedRequirementId: null, selectRequirement: deps.selectRequirement });

    expect(listener.mock.calls.map(([event]) => event.type)).toEqual([
      "table-data-changed",
      "table-data-changed",
      "selection-changed",
    ]);
    unsubscribe();
    deps.uiStore.set({ selectedRequirementId: requirement.id, selectRequirement: deps.selectRequirement });
    expect(listener).toHaveBeenCalledTimes(3);
    adapter.dispose();
  });

  it("HostActions.openRecord 只调用 uiStore.selectRequirement", async () => {
    const deps = dependencies();
    const actions = createCurrentProjectHostActions(deps);

    await actions.openRecord({ tableId: "project-a", recordId: "requirement-a" });

    expect(deps.selectRequirement).toHaveBeenCalledOnce();
    expect(deps.selectRequirement).toHaveBeenCalledWith("requirement-a");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const files = new Map<string, string>();

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => files.has(path)),
  mkdir: vi.fn(async () => undefined),
  readDir: vi.fn(async () => []),
  readTextFile: vi.fn(async (path: string) => files.get(path) ?? ""),
  writeTextFile: vi.fn(async (path: string, content: string) => {
    files.set(path, content);
  }),
  remove: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "/app-local-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

const { useSchemaStore } = await import("./schemaStore");

describe("schemaStore.loadForProject", () => {
  beforeEach(() => {
    files.clear();
    useSchemaStore.setState({ schema: null, loadedProjectId: null, justMigrated: false });
  });

  it("旧项目（无 schema.json）加载后 justMigrated=true，且 schema 与硬编码字段等价", async () => {
    const { loadForProject } = useSchemaStore.getState();
    await loadForProject("proj-1", ["内部想法"]);

    const state = useSchemaStore.getState();
    expect(state.justMigrated).toBe(true);
    expect(state.loadedProjectId).toBe("proj-1");
    expect(state.schema?.attributes.some((a) => a.id === "priority")).toBe(true);
  });

  it("已有 schema.json 的项目加载后 justMigrated=false", async () => {
    await useSchemaStore.getState().loadForProject("proj-1", ["内部想法"]);
    useSchemaStore.setState({ schema: null, loadedProjectId: null, justMigrated: false });

    await useSchemaStore.getState().loadForProject("proj-1", ["内部想法"]);

    expect(useSchemaStore.getState().justMigrated).toBe(false);
  });

  it("acknowledgeMigration 清除 justMigrated 标记", async () => {
    await useSchemaStore.getState().loadForProject("proj-1", ["内部想法"]);
    expect(useSchemaStore.getState().justMigrated).toBe(true);

    useSchemaStore.getState().acknowledgeMigration();

    expect(useSchemaStore.getState().justMigrated).toBe(false);
  });
});

describe("schemaStore 属性/阶段/Tab CRUD", () => {
  beforeEach(async () => {
    files.clear();
    useSchemaStore.setState({ schema: null, loadedProjectId: null, justMigrated: false });
    await useSchemaStore.getState().loadForProject("proj-1", []);
  });

  it("addAttribute 新增属性后落盘，可从 schema.json 读回", async () => {
    const { addAttribute } = useSchemaStore.getState();
    await addAttribute("proj-1", { id: "custom-1", name: "自定义属性", type: "text", showOnBoard: true, showOnDetail: true });

    expect(useSchemaStore.getState().schema?.attributes.some((a) => a.id === "custom-1")).toBe(true);
    const raw = files.get("/app-local-data/projects/proj-1/schema.json")!;
    expect(JSON.parse(raw).attributes.some((a: { id: string }) => a.id === "custom-1")).toBe(true);
  });

  it("updateAttribute 只更新目标属性，不影响其他属性", async () => {
    const { updateAttribute } = useSchemaStore.getState();
    await updateAttribute("proj-1", "priority", { showOnBoard: false });

    const attrs = useSchemaStore.getState().schema?.attributes ?? [];
    expect(attrs.find((a) => a.id === "priority")?.showOnBoard).toBe(false);
    expect(attrs.find((a) => a.id === "assignee")?.showOnBoard).toBe(true);
  });

  it("removeAttribute 删除后该属性不再出现在 schema 中", async () => {
    const { removeAttribute } = useSchemaStore.getState();
    await removeAttribute("proj-1", "priority");

    expect(useSchemaStore.getState().schema?.attributes.some((a) => a.id === "priority")).toBe(false);
  });

  it("updateStageOption 修改阶段颜色和终态标记", async () => {
    const { updateStageOption } = useSchemaStore.getState();
    await updateStageOption("proj-1", "collect", { color: "hsl(0, 0%, 0%)", isTerminal: true });

    const stage = useSchemaStore.getState().schema?.stageOptions.find((s) => s.id === "collect");
    expect(stage?.color).toBe("hsl(0, 0%, 0%)");
    expect(stage?.isTerminal).toBe(true);
  });

  it("removeStageOption 删除后该阶段选项不再出现", async () => {
    const { addStageOption, removeStageOption } = useSchemaStore.getState();
    await addStageOption("proj-1", { id: "extra", label: "额外阶段", color: "hsl(0,0%,0%)", isTerminal: false });
    await removeStageOption("proj-1", "extra");

    expect(useSchemaStore.getState().schema?.stageOptions.some((s) => s.id === "extra")).toBe(false);
  });

  it("removeStageOption 只剩最后一个阶段选项时拒绝删除（REQ-025：最少保留 1 个）", async () => {
    const { removeStageOption } = useSchemaStore.getState();
    const onlyStageId = useSchemaStore.getState().schema!.stageOptions[0].id;

    // 迁移后的 legacy schema 有 7 个阶段，先删到只剩 1 个再验证防呆
    for (const s of useSchemaStore.getState().schema!.stageOptions.slice(1)) {
      await removeStageOption("proj-1", s.id);
    }
    expect(useSchemaStore.getState().schema?.stageOptions).toHaveLength(1);

    await removeStageOption("proj-1", onlyStageId);

    expect(useSchemaStore.getState().schema?.stageOptions).toHaveLength(1);
    expect(useSchemaStore.getState().schema?.stageOptions[0].id).toBe(onlyStageId);
  });

  it("reorderStageOptions 按传入的 id 顺序重排阶段选项并落盘", async () => {
    const { addStageOption, reorderStageOptions } = useSchemaStore.getState();
    await addStageOption("proj-1", { id: "extra", label: "额外阶段", color: "hsl(0,0%,0%)", isTerminal: false });
    const originalOrder = useSchemaStore.getState().schema!.stageOptions.map((s) => s.id);
    const reversed = originalOrder.slice().reverse();

    await reorderStageOptions("proj-1", reversed);

    expect(useSchemaStore.getState().schema?.stageOptions.map((s) => s.id)).toEqual(reversed);
    const raw = files.get("/app-local-data/projects/proj-1/schema.json")!;
    expect(JSON.parse(raw).stageOptions.map((s: { id: string }) => s.id)).toEqual(reversed);
  });

  it("addTab / updateTab / removeTab 基础 CRUD 正常工作", async () => {
    const { addTab, updateTab, removeTab } = useSchemaStore.getState();
    await addTab("proj-1", { id: "custom-tab", name: "自定义 Tab", renderer: "generic", visible: true });
    expect(useSchemaStore.getState().schema?.tabs.some((t) => t.id === "custom-tab")).toBe(true);

    await updateTab("proj-1", "custom-tab", { visible: false });
    expect(useSchemaStore.getState().schema?.tabs.find((t) => t.id === "custom-tab")?.visible).toBe(false);

    await removeTab("proj-1", "custom-tab");
    expect(useSchemaStore.getState().schema?.tabs.some((t) => t.id === "custom-tab")).toBe(false);
  });
});

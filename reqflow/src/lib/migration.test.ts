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

const { migrateIfNeeded } = await import("./migration");

describe("migrateIfNeeded", () => {
  beforeEach(() => {
    files.clear();
  });

  it("项目目录下无 schema.json 时生成与硬编码字段等价的 Schema 并落盘，migrated=true", async () => {
    const { migrated, schema } = await migrateIfNeeded("proj-1", ["用户反馈", "内部想法"]);

    expect(migrated).toBe(true);
    expect(schema.stageOptions.map((s) => s.id)).toEqual([
      "collect",
      "need",
      "design",
      "dev",
      "verify",
      "release",
      "archive",
    ]);
    expect(schema.attributes.some((a) => a.id === "priority")).toBe(true);
    expect(schema.attributes.some((a) => a.id === "result")).toBe(true);

    const written = files.get("/app-local-data/projects/proj-1/schema.json");
    expect(written).toBeDefined();
    expect(JSON.parse(written!).version).toBe(schema.version);
  });

  it("已存在 schema.json 时直接读回，不重新生成（幂等）", async () => {
    const first = await migrateIfNeeded("proj-1", ["内部想法"]);
    expect(first.migrated).toBe(true);

    const second = await migrateIfNeeded("proj-1", ["内部想法"]);
    expect(second.migrated).toBe(false);
    expect(second.schema).toEqual(first.schema);
  });

  it("迁移生成的属性里保留优先级/负责人/来源/截止日期等与旧硬编码字段等价的属性", async () => {
    const { schema } = await migrateIfNeeded("proj-1", ["用户反馈"]);
    const ids = schema.attributes.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining(["priority", "assignee", "source", "deadline", "progress", "release_method", "release_date", "result"]),
    );
  });

  it("读回 Phase 19 之前写入的 schema.json（无 viewPreferences.frozenCount）时补默认值 0，不丢失已有的列宽/列序", async () => {
    files.set(
      "/app-local-data/projects/proj-1/schema.json",
      JSON.stringify({
        version: 1,
        stageOptions: [],
        attributes: [],
        tabs: [],
        viewPreferences: { columnOrder: ["priority"], columnWidths: { priority: 80 } },
      }),
    );

    const { migrated, schema } = await migrateIfNeeded("proj-1", []);

    expect(migrated).toBe(false);
    expect(schema.viewPreferences.frozenCount).toBe(0);
    expect(schema.viewPreferences.filters).toEqual([]);
    expect(schema.viewPreferences.globalSort).toBeNull();
    expect(schema.viewPreferences.stageSorts).toEqual({});
    expect(schema.viewPreferences.columnOrder).toEqual(["priority"]);
    expect(schema.viewPreferences.columnWidths).toEqual({ priority: 80 });
  });

  it("为缺少颜色的 Schema 选项分配稳定色并落盘，同时保留已有自定义颜色", async () => {
    files.set(
      "/app-local-data/projects/proj-1/schema.json",
      JSON.stringify({
        version: 1,
        stageOptions: [],
        attributes: [{ id: "status", name: "状态", type: "singleSelect", options: [
          { id: "a", label: "A" },
          { id: "b", label: "B", color: "#ABCDEF" },
        ], showOnBoard: true, showOnDetail: true }],
        tabs: [],
        viewPreferences: { columnOrder: [], columnWidths: {}, frozenCount: 0, filters: [], globalSort: null, stageSorts: {} },
      }),
    );

    const { schema } = await migrateIfNeeded("proj-1", []);
    const options = schema.attributes[0].options ?? [];

    expect(options[0].color).toBeDefined();
    expect(options[1].color).toBe("#ABCDEF");
    expect(JSON.parse(files.get("/app-local-data/projects/proj-1/schema.json")!).attributes[0].options[0].color).toBe(options[0].color);
  });

  it("为缺少颜色的阶段分配稳定色并落盘，同时保留已有阶段自定义颜色", async () => {
    files.set(
      "/app-local-data/projects/proj-1/schema.json",
      JSON.stringify({
        version: 1,
        stageOptions: [
          { id: "collect", label: "收集", isTerminal: false },
          { id: "design", label: "设计", color: "#ABCDEF", isTerminal: false },
        ],
        attributes: [],
        tabs: [],
        viewPreferences: { columnOrder: [], columnWidths: {}, frozenCount: 0, filters: [], globalSort: null, stageSorts: {} },
      }),
    );

    const { schema } = await migrateIfNeeded("proj-1", []);
    expect(schema.stageOptions[0].color).toBeDefined();
    expect(schema.stageOptions[1].color).toBe("#ABCDEF");
    expect(JSON.parse(files.get("/app-local-data/projects/proj-1/schema.json")!).stageOptions[0].color).toBe(schema.stageOptions[0].color);
  });

  it("迁移补色会避开同组已有颜色，不因索引重复", async () => {
    files.set(
      "/app-local-data/projects/proj-1/schema.json",
      JSON.stringify({
        version: 1,
        stageOptions: [
          { id: "a", label: "A", isTerminal: false },
          { id: "b", label: "B", color: "#3F7A02", isTerminal: false },
        ],
        attributes: [{ id: "status", name: "状态", type: "singleSelect", options: [{ id: "a", label: "A" }, { id: "b", label: "B", color: "#5D3A73" }], showOnBoard: true, showOnDetail: true }],
        tabs: [],
        viewPreferences: { columnOrder: [], columnWidths: {}, frozenCount: 0, filters: [], globalSort: null, stageSorts: {} },
      }),
    );

    const { schema } = await migrateIfNeeded("proj-1", []);
    expect(schema.stageOptions[0].color).not.toBe("#3F7A02");
    expect(schema.attributes[0].options?.[0].color).not.toBe("#5D3A73");
  });
});

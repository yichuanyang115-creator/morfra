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
});

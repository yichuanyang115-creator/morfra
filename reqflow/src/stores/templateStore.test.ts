import { beforeEach, describe, expect, it, vi } from "vitest";
import { legacyEquivalentSchema } from "../lib/schemaDefaults";

const files = new Map<string, string>();

vi.mock("../lib/fs", () => ({
  ensureDir: vi.fn(async () => undefined),
  listFileNames: vi.fn(async (root: string) =>
    [...files.keys()]
      .filter((path) => path.startsWith(`${root}/`))
      .map((path) => path.slice(root.length + 1))
      .filter((name) => !name.includes("/")),
  ),
  readFile: vi.fn(async (path: string) => files.get(path) ?? null),
  removeFile: vi.fn(async (path: string) => files.delete(path)),
  writeFile: vi.fn(async (path: string, content: string) => files.set(path, content)),
}));

vi.mock("../lib/paths", () => ({
  templatesRootDir: vi.fn(async () => "/templates"),
  templatePath: vi.fn(async (id: string) => `/templates/${id}.json`),
  templatesInitializedPath: vi.fn(async () => "/templates/.initialized"),
}));

const { useTemplateStore } = await import("./templateStore");

describe("templateStore（REQ-028 模板系统）", () => {
  beforeEach(() => {
    files.clear();
    useTemplateStore.setState({ templates: [], loaded: false, loading: false, error: null });
  });

  it("首次加载写入 reqflow 内置模板，且快照不包含项目视图偏好", async () => {
    await useTemplateStore.getState().load();

    const [template] = useTemplateStore.getState().templates;
    expect(template.name).toBe("reqflow");
    expect(template.schemaSnapshot.stageOptions).toHaveLength(7);
    expect(template.schemaSnapshot.attributes.length).toBeGreaterThan(0);
    expect(template.schemaSnapshot.tabs.map((tab) => tab.renderer)).toEqual(["body", "deliverables", "tasks", "acceptance", "activity"]);
    expect(template.schemaSnapshot).not.toHaveProperty("viewPreferences");
  });

  it("保存自定义模板时只落 Schema 结构，重命名和删除同步更新列表与文件", async () => {
    const schema = legacyEquivalentSchema([]);
    schema.viewPreferences.columnWidths.priority = 280;
    await useTemplateStore.getState().saveFromSchema("团队流程", schema);

    const custom = useTemplateStore.getState().templates.find((template) => template.name === "团队流程");
    expect(custom).toBeDefined();
    expect(custom?.schemaSnapshot).not.toHaveProperty("viewPreferences");
    expect(files.get(`/templates/${custom?.id}.json`)).not.toContain("columnWidths");

    if (!custom) throw new Error("测试前提缺失：自定义模板没有保存");
    await useTemplateStore.getState().rename(custom.id, "团队标准流程");
    expect(useTemplateStore.getState().templates.some((template) => template.name === "团队标准流程")).toBe(true);

    await useTemplateStore.getState().remove(custom.id);
    expect(useTemplateStore.getState().templates.some((template) => template.id === custom.id)).toBe(false);
    expect(files.has(`/templates/${custom.id}.json`)).toBe(false);
  });
});

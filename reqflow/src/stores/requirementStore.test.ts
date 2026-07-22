import { beforeEach, describe, expect, it, vi } from "vitest";

const files = new Map<string, string>();

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => {
    if (files.has(path)) return true;
    return [...files.keys()].some((filePath) => filePath.startsWith(`${path}/`));
  }),
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

const { useRequirementStore } = await import("./requirementStore");

describe("requirementStore.updateBody", () => {
  beforeEach(() => {
    files.clear();
    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
  });

  it("createRequirement 落盘的文件 body 区默认为空，updateBody 写入后 body 落盘且 frontmatter 字段不变", async () => {
    const { createRequirement, updateBody } = useRequirementStore.getState();

    await createRequirement("proj-1", "collect", "测试需求");
    const created = useRequirementStore.getState().requirements[0];
    expect(created.body).toBe("");

    const markdown = "## 背景\n\n正文内容\n";
    await updateBody("proj-1", created.id, markdown);

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.body).toBe(markdown);
    // 其余字段应保持不变，updateBody 不能连带改动其他 frontmatter 字段
    expect(updated?.name).toBe("测试需求");
    expect(updated?.stage).toBe("collect");

    const filePath = `/app-local-data/projects/proj-1/${created.id}.md`;
    const raw = files.get(filePath);
    expect(raw).toBeDefined();
    expect(raw).toContain("---");
    expect(raw).toContain(`id: ${created.id}`);
    expect(raw).toContain("## 背景");
    expect(raw).toContain("正文内容");
  });

  it("loadForProject 重新读取落盘文件后，body 内容原样还原（模拟关闭重开应用）", async () => {
    const { createRequirement, updateBody, loadForProject } = useRequirementStore.getState();

    await createRequirement("proj-1", "need", "需求 X");
    const created = useRequirementStore.getState().requirements[0];
    const markdown = "## 现状问题\n\n- 问题一\n- 问题二\n";
    await updateBody("proj-1", created.id, markdown);

    // 模拟重开：清空内存态，走 loadForProject 从磁盘重新加载
    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${created.id}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);

    await loadForProject("proj-1");

    const reloaded = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(reloaded?.body).toBe(markdown);
    expect(reloaded?.name).toBe("需求 X");
  });

  it("updateBody 对不存在的 requirementId 不写入任何文件（边界：目标需求已被删除）", async () => {
    const { updateBody } = useRequirementStore.getState();
    await updateBody("proj-1", "non-existent-id", "## 不应落盘的内容");
    expect(files.size).toBe(0);
  });
});

describe("requirementStore 产出（deliverable）CRUD", () => {
  beforeEach(() => {
    files.clear();
    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
  });

  it("addDeliverable 新增一条产出，默认未完成且无附件，落盘后可从 frontmatter 读回", async () => {
    const { createRequirement, addDeliverable } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "需求 A");
    const created = useRequirementStore.getState().requirements[0];

    await addDeliverable("proj-1", created.id, "首页原型图");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.deliverables).toHaveLength(1);
    expect(updated?.deliverables[0].name).toBe("首页原型图");
    expect(updated?.deliverables[0].checked).toBe(false);
    expect(updated?.deliverables[0].attach).toBeNull();

    const filePath = `/app-local-data/projects/proj-1/${created.id}.md`;
    const raw = files.get(filePath) ?? "";
    expect(raw).toContain("首页原型图");
  });

  it("updateDeliverable 勾选完成只影响目标条目的 checked，不影响其他条目和其他字段", async () => {
    const { createRequirement, addDeliverable, updateDeliverable } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "需求 B");
    const created = useRequirementStore.getState().requirements[0];

    await addDeliverable("proj-1", created.id, "产出一");
    await addDeliverable("proj-1", created.id, "产出二");
    const [first, second] = useRequirementStore.getState().requirements[0].deliverables;

    await updateDeliverable("proj-1", created.id, first.id, { checked: true });

    const deliverables = useRequirementStore.getState().requirements[0].deliverables;
    expect(deliverables.find((d) => d.id === first.id)?.checked).toBe(true);
    expect(deliverables.find((d) => d.id === second.id)?.checked).toBe(false);
    expect(deliverables.find((d) => d.id === second.id)?.name).toBe("产出二");
  });

  it("updateDeliverable 挂文件附件后可以只清除 attach（移除附件）而保留条目本身", async () => {
    const { createRequirement, addDeliverable, updateDeliverable } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "需求 C");
    const created = useRequirementStore.getState().requirements[0];
    await addDeliverable("proj-1", created.id, "设计稿");
    const deliverable = useRequirementStore.getState().requirements[0].deliverables[0];

    await updateDeliverable("proj-1", created.id, deliverable.id, {
      attach: { type: "file", url: "/Users/test/design.fig", label: "design.fig" },
    });
    expect(useRequirementStore.getState().requirements[0].deliverables[0].attach?.label).toBe("design.fig");

    await updateDeliverable("proj-1", created.id, deliverable.id, { attach: null });

    const afterRemove = useRequirementStore.getState().requirements[0];
    expect(afterRemove.deliverables).toHaveLength(1);
    expect(afterRemove.deliverables[0].attach).toBeNull();
    expect(afterRemove.deliverables[0].name).toBe("设计稿");
  });

  it("removeDeliverable 删除条目后该产出不再出现在列表和落盘文件中", async () => {
    const { createRequirement, addDeliverable, removeDeliverable } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "需求 D");
    const created = useRequirementStore.getState().requirements[0];
    await addDeliverable("proj-1", created.id, "要被删除的产出");
    const deliverable = useRequirementStore.getState().requirements[0].deliverables[0];

    await removeDeliverable("proj-1", created.id, deliverable.id);

    const updated = useRequirementStore.getState().requirements[0];
    expect(updated.deliverables).toHaveLength(0);
    const filePath = `/app-local-data/projects/proj-1/${created.id}.md`;
    expect(files.get(filePath) ?? "").not.toContain("要被删除的产出");
  });

  it("重开应用后（loadForProject 重新读盘）产出列表、完成状态和附件原样还原", async () => {
    const { createRequirement, addDeliverable, updateDeliverable, loadForProject } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "需求 E");
    const created = useRequirementStore.getState().requirements[0];
    await addDeliverable("proj-1", created.id, "产出甲");
    const deliverable = useRequirementStore.getState().requirements[0].deliverables[0];
    await updateDeliverable("proj-1", created.id, deliverable.id, {
      checked: true,
      attach: { type: "link", url: "https://example.com/spec", label: "https://example.com/spec" },
    });

    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${created.id}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);
    await loadForProject("proj-1");

    const reloaded = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(reloaded?.deliverables).toHaveLength(1);
    expect(reloaded?.deliverables[0].name).toBe("产出甲");
    expect(reloaded?.deliverables[0].checked).toBe(true);
    expect(reloaded?.deliverables[0].attach?.url).toBe("https://example.com/spec");
  });

  it("没有 deliverables 字段的旧格式文件（Phase 5 之前创建）加载时不报错，deliverables 兜底为空数组", async () => {
    const { loadForProject } = useRequirementStore.getState();
    const legacyId = "legacy-req";
    files.set(
      `/app-local-data/projects/proj-1/${legacyId}.md`,
      "---\nid: legacy-req\nname: 旧需求\nstage: design\npriority: P1\nsource: 内部想法\nassignee: ''\ndeadline: ''\nprogress: null\nclosureType: null\ncreatedAt: '2026-01-01T00:00:00.000Z'\n---\n\n旧正文",
    );
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${legacyId}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);

    await loadForProject("proj-1");

    const loaded = useRequirementStore.getState().requirements.find((r) => r.id === legacyId);
    expect(loaded?.deliverables).toEqual([]);
    expect(loaded?.name).toBe("旧需求");
  });
});

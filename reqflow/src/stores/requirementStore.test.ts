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

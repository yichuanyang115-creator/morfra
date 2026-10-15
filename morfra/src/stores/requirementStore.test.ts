import { beforeEach, describe, expect, it, vi } from "vitest";
import { progressOf, releaseDateOf, resultOf } from "../lib/requirementFields";
import { undoStack } from "../lib/undoStack";

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
  remove: vi.fn(async (path: string) => {
    files.delete(path);
  }),
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

  it("一个需求文件损坏（frontmatter 解析报错）不影响其余需求正常加载，坏文件被跳过", async () => {
    const { createRequirement, loadForProject } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "正常需求");
    const good = useRequirementStore.getState().requirements[0];

    const brokenId = "broken-req";
    files.set(
      `/app-local-data/projects/proj-1/${brokenId}.md`,
      "---\nname: [ 没有闭合的 YAML\n---\n\n坏文件",
    );

    const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
    const brokenPath = `/app-local-data/projects/proj-1/${brokenId}.md`;
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${good.id}.md`, isFile: true, isDirectory: false, isSymlink: false },
      { name: `${brokenId}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);
    const originalReadTextFile = vi.mocked(readTextFile).getMockImplementation()!;
    vi.mocked(readTextFile).mockImplementation(async (path) => {
      if (path === brokenPath) throw new Error("YAML parse error");
      return originalReadTextFile(path);
    });

    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
    await loadForProject("proj-1");

    const state = useRequirementStore.getState();
    expect(state.error).toBe(false);
    expect(state.requirements).toHaveLength(1);
    expect(state.requirements[0].id).toBe(good.id);

    vi.mocked(readTextFile).mockImplementation(originalReadTextFile);
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

describe("requirementStore 任务（task）CRUD", () => {
  beforeEach(() => {
    files.clear();
    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
  });

  it("addTask 新增一条任务，默认状态待开始、未阻塞，落盘后可从 frontmatter 读回", async () => {
    const { createRequirement, addTask } = useRequirementStore.getState();
    await createRequirement("proj-1", "dev", "需求 A");
    const created = useRequirementStore.getState().requirements[0];

    await addTask("proj-1", created.id, { name: "单测覆盖", assignee: "吴桐", deadline: "", progress: null });

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.tasks).toHaveLength(1);
    expect(updated?.tasks[0].name).toBe("单测覆盖");
    expect(updated?.tasks[0].assignee).toBe("吴桐");
    expect(updated?.tasks[0].status).toBe("todo");
    expect(updated?.tasks[0].blocked).toBe(false);
    expect(updated?.tasks[0].blockNote).toBe("");

    const filePath = `/app-local-data/projects/proj-1/${created.id}.md`;
    const raw = files.get(filePath) ?? "";
    expect(raw).toContain("单测覆盖");
  });

  it("updateTask 循环状态只影响目标任务的 status，不影响其他任务和其他字段", async () => {
    const { createRequirement, addTask, updateTask } = useRequirementStore.getState();
    await createRequirement("proj-1", "dev", "需求 B");
    const created = useRequirementStore.getState().requirements[0];

    await addTask("proj-1", created.id, { name: "任务一", assignee: "", deadline: "", progress: null });
    await addTask("proj-1", created.id, { name: "任务二", assignee: "", deadline: "", progress: null });
    const [first, second] = useRequirementStore.getState().requirements[0].tasks;

    await updateTask("proj-1", created.id, first.id, { status: "progress" });

    const tasks = useRequirementStore.getState().requirements[0].tasks;
    expect(tasks.find((t) => t.id === first.id)?.status).toBe("progress");
    expect(tasks.find((t) => t.id === second.id)?.status).toBe("todo");
    expect(tasks.find((t) => t.id === second.id)?.name).toBe("任务二");
  });

  it("updateTask 可以在任意状态下独立设置 blocked，不影响 status", async () => {
    const { createRequirement, addTask, updateTask } = useRequirementStore.getState();
    await createRequirement("proj-1", "dev", "需求 C");
    const created = useRequirementStore.getState().requirements[0];
    await addTask("proj-1", created.id, { name: "任务", assignee: "", deadline: "", progress: null });
    const task = useRequirementStore.getState().requirements[0].tasks[0];

    await updateTask("proj-1", created.id, task.id, { status: "progress" });
    await updateTask("proj-1", created.id, task.id, { blocked: true, blockNote: "等待依赖" });

    const updated = useRequirementStore.getState().requirements[0].tasks[0];
    expect(updated.status).toBe("progress");
    expect(updated.blocked).toBe(true);
    expect(updated.blockNote).toBe("等待依赖");
  });

  it("removeTask 删除任务后该任务不再出现在列表和落盘文件中", async () => {
    const { createRequirement, addTask, removeTask } = useRequirementStore.getState();
    await createRequirement("proj-1", "dev", "需求 D");
    const created = useRequirementStore.getState().requirements[0];
    await addTask("proj-1", created.id, { name: "要被删除的任务", assignee: "", deadline: "", progress: null });
    const task = useRequirementStore.getState().requirements[0].tasks[0];

    await removeTask("proj-1", created.id, task.id);

    const updated = useRequirementStore.getState().requirements[0];
    expect(updated.tasks).toHaveLength(0);
    const filePath = `/app-local-data/projects/proj-1/${created.id}.md`;
    expect(files.get(filePath) ?? "").not.toContain("要被删除的任务");
  });

  it("重开应用后（loadForProject 重新读盘）任务列表、状态、阻塞和进度原样还原", async () => {
    const { createRequirement, addTask, updateTask, loadForProject } = useRequirementStore.getState();
    await createRequirement("proj-1", "dev", "需求 E");
    const created = useRequirementStore.getState().requirements[0];
    await addTask("proj-1", created.id, { name: "任务甲", assignee: "吴桐", deadline: "2026-08-01", progress: 40 });
    const task = useRequirementStore.getState().requirements[0].tasks[0];
    await updateTask("proj-1", created.id, task.id, { status: "progress", blocked: true, blockNote: "等待接口" });

    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${created.id}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);
    await loadForProject("proj-1");

    const reloaded = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(reloaded?.tasks).toHaveLength(1);
    expect(reloaded?.tasks[0].name).toBe("任务甲");
    expect(reloaded?.tasks[0].status).toBe("progress");
    expect(reloaded?.tasks[0].blocked).toBe(true);
    expect(reloaded?.tasks[0].blockNote).toBe("等待接口");
    expect(reloaded?.tasks[0].progress).toBe(40);
  });

  it("没有 tasks 字段的旧格式文件加载时不报错，tasks 兜底为空数组", async () => {
    const { loadForProject } = useRequirementStore.getState();
    const legacyId = "legacy-req-2";
    files.set(
      `/app-local-data/projects/proj-1/${legacyId}.md`,
      "---\nid: legacy-req-2\nname: 旧需求\nstage: dev\npriority: P1\nsource: 内部想法\nassignee: ''\ndeadline: ''\nprogress: null\nclosureType: null\ncreatedAt: '2026-01-01T00:00:00.000Z'\ndeliverables: []\n---\n\n旧正文",
    );
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${legacyId}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);

    await loadForProject("proj-1");

    const loaded = useRequirementStore.getState().requirements.find((r) => r.id === legacyId);
    expect(loaded?.tasks).toEqual([]);
    expect(loaded?.name).toBe("旧需求");
  });
});

describe("requirementStore 验收标准（acceptance）CRUD", () => {
  beforeEach(() => {
    files.clear();
    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
  });

  it("addAcceptance 新增一条验收标准，默认结果未验证、不通过原因为空，落盘后可从 frontmatter 读回", async () => {
    const { createRequirement, addAcceptance } = useRequirementStore.getState();
    await createRequirement("proj-1", "verify", "需求 A");
    const created = useRequirementStore.getState().requirements[0];

    await addAcceptance("proj-1", created.id, "登录成功后跳转首页");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.acceptance).toHaveLength(1);
    expect(updated?.acceptance[0].desc).toBe("登录成功后跳转首页");
    expect(updated?.acceptance[0].result).toBe("unverified");
    expect(updated?.acceptance[0].failNote).toBe("");

    const filePath = `/app-local-data/projects/proj-1/${created.id}.md`;
    const raw = files.get(filePath) ?? "";
    expect(raw).toContain("登录成功后跳转首页");
  });

  it("updateAcceptance 修改结果只影响目标条目的 result，不影响其他条目和其他字段", async () => {
    const { createRequirement, addAcceptance, updateAcceptance } = useRequirementStore.getState();
    await createRequirement("proj-1", "verify", "需求 B");
    const created = useRequirementStore.getState().requirements[0];

    await addAcceptance("proj-1", created.id, "验收一");
    await addAcceptance("proj-1", created.id, "验收二");
    const [first, second] = useRequirementStore.getState().requirements[0].acceptance;

    await updateAcceptance("proj-1", created.id, first.id, { result: "pass" });

    const acceptance = useRequirementStore.getState().requirements[0].acceptance;
    expect(acceptance.find((a) => a.id === first.id)?.result).toBe("pass");
    expect(acceptance.find((a) => a.id === second.id)?.result).toBe("unverified");
    expect(acceptance.find((a) => a.id === second.id)?.desc).toBe("验收二");
  });

  it("updateAcceptance 设置结果为不通过并填写原因，两个字段都正确落盘", async () => {
    const { createRequirement, addAcceptance, updateAcceptance } = useRequirementStore.getState();
    await createRequirement("proj-1", "verify", "需求 C");
    const created = useRequirementStore.getState().requirements[0];
    await addAcceptance("proj-1", created.id, "验收标准");
    const criterion = useRequirementStore.getState().requirements[0].acceptance[0];

    await updateAcceptance("proj-1", created.id, criterion.id, { result: "fail", failNote: "接口 500" });

    const updated = useRequirementStore.getState().requirements[0].acceptance[0];
    expect(updated.result).toBe("fail");
    expect(updated.failNote).toBe("接口 500");
  });

  it("removeAcceptance 删除条目后该验收标准不再出现在列表和落盘文件中", async () => {
    const { createRequirement, addAcceptance, removeAcceptance } = useRequirementStore.getState();
    await createRequirement("proj-1", "verify", "需求 D");
    const created = useRequirementStore.getState().requirements[0];
    await addAcceptance("proj-1", created.id, "要被删除的验收标准");
    const criterion = useRequirementStore.getState().requirements[0].acceptance[0];

    await removeAcceptance("proj-1", created.id, criterion.id);

    const updated = useRequirementStore.getState().requirements[0];
    expect(updated.acceptance).toHaveLength(0);
    const filePath = `/app-local-data/projects/proj-1/${created.id}.md`;
    expect(files.get(filePath) ?? "").not.toContain("要被删除的验收标准");
  });

  it("重开应用后（loadForProject 重新读盘）验收标准列表、结果和不通过原因原样还原", async () => {
    const { createRequirement, addAcceptance, updateAcceptance, loadForProject } = useRequirementStore.getState();
    await createRequirement("proj-1", "verify", "需求 E");
    const created = useRequirementStore.getState().requirements[0];
    await addAcceptance("proj-1", created.id, "验收标准甲");
    const criterion = useRequirementStore.getState().requirements[0].acceptance[0];
    await updateAcceptance("proj-1", created.id, criterion.id, { result: "fail", failNote: "超时未响应" });

    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${created.id}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);
    await loadForProject("proj-1");

    const reloaded = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(reloaded?.acceptance).toHaveLength(1);
    expect(reloaded?.acceptance[0].desc).toBe("验收标准甲");
    expect(reloaded?.acceptance[0].result).toBe("fail");
    expect(reloaded?.acceptance[0].failNote).toBe("超时未响应");
  });

  it("没有 acceptance 字段的旧格式文件加载时不报错，acceptance 兜底为空数组", async () => {
    const { loadForProject } = useRequirementStore.getState();
    const legacyId = "legacy-req-3";
    files.set(
      `/app-local-data/projects/proj-1/${legacyId}.md`,
      "---\nid: legacy-req-3\nname: 旧需求\nstage: verify\npriority: P1\nsource: 内部想法\nassignee: ''\ndeadline: ''\nprogress: null\nclosureType: null\ncreatedAt: '2026-01-01T00:00:00.000Z'\ndeliverables: []\ntasks: []\n---\n\n旧正文",
    );
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${legacyId}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);

    await loadForProject("proj-1");

    const loaded = useRequirementStore.getState().requirements.find((r) => r.id === legacyId);
    expect(loaded?.acceptance).toEqual([]);
    expect(loaded?.name).toBe("旧需求");
  });
});

describe("requirementStore 流转（transition）与评论", () => {
  beforeEach(() => {
    files.clear();
    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
  });

  it("transitionRequirement 正常流转后 stage 更新、新增一条流转记录，closureType 保持为 null", async () => {
    const { createRequirement, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "需求 A");
    const created = useRequirementStore.getState().requirements[0];

    await transitionRequirement("proj-1", created.id, "dev");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.stage).toBe("dev");
    expect(updated ? resultOf(updated) : undefined).toBeNull();
    expect(updated?.transitions).toHaveLength(1);
    expect(updated?.transitions[0].from).toBe("design");
    expect(updated?.transitions[0].to).toBe("dev");
    expect(updated?.transitions[0].by).toBe("我");

    const filePath = `/app-local-data/projects/proj-1/${created.id}.md`;
    const raw = files.get(filePath) ?? "";
    expect(raw).toContain("design");
  });

  it("transitionRequirement 流转到发布阶段时不自动设置 closureType，只有流转到归档才设置", async () => {
    const { createRequirement, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "verify", "需求 B");
    const created = useRequirementStore.getState().requirements[0];

    await transitionRequirement("proj-1", created.id, "release");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.stage).toBe("release");
    expect(updated ? resultOf(updated) : undefined).toBeNull();
  });

  it("transitionRequirement 流转到归档（正常完成路径）时 closureType 设为 completed", async () => {
    const { createRequirement, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "release", "需求 C");
    const created = useRequirementStore.getState().requirements[0];

    await transitionRequirement("proj-1", created.id, "archive");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.stage).toBe("archive");
    expect(updated ? resultOf(updated) : undefined).toBe("completed");
    expect(updated?.transitions[0].to).toBe("archive");
  });

  it("transitionRequirement 传 abandoned 选项时，不论目标阶段是什么都直接归档且 closureType 为 abandoned", async () => {
    const { createRequirement, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "dev", "需求 D");
    const created = useRequirementStore.getState().requirements[0];

    await transitionRequirement("proj-1", created.id, "dev", { abandoned: true });

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.stage).toBe("archive");
    expect(updated ? resultOf(updated) : undefined).toBe("abandoned");
    expect(updated?.transitions[0].from).toBe("dev");
    expect(updated?.transitions[0].to).toBe("archive");
  });

  it("需求经过 2 次流转后 transitions 数组按顺序累加 2 条记录", async () => {
    const { createRequirement, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "需求 E");
    const created = useRequirementStore.getState().requirements[0];

    await transitionRequirement("proj-1", created.id, "need");
    await transitionRequirement("proj-1", created.id, "design");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.transitions).toHaveLength(2);
    expect(updated?.transitions[0]).toMatchObject({ from: "collect", to: "need" });
    expect(updated?.transitions[1]).toMatchObject({ from: "need", to: "design" });
  });

  it("updateTransitionNote 只更新目标流转记录的 note，不影响其他记录", async () => {
    const { createRequirement, transitionRequirement, updateTransitionNote } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "需求 F");
    const created = useRequirementStore.getState().requirements[0];
    await transitionRequirement("proj-1", created.id, "need");
    await transitionRequirement("proj-1", created.id, "design");
    const [first, second] = useRequirementStore.getState().requirements[0].transitions;

    await updateTransitionNote("proj-1", created.id, first.id, "优先级评估为 P0");

    const transitions = useRequirementStore.getState().requirements[0].transitions;
    expect(transitions.find((t) => t.id === first.id)?.note).toBe("优先级评估为 P0");
    expect(transitions.find((t) => t.id === second.id)?.note).toBe("");
  });

  it("addComment 新增评论并正确关联到目标流转记录", async () => {
    const { createRequirement, transitionRequirement, addComment } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "需求 G");
    const created = useRequirementStore.getState().requirements[0];
    await transitionRequirement("proj-1", created.id, "need");
    const transition = useRequirementStore.getState().requirements[0].transitions[0];

    await addComment("proj-1", created.id, transition.id, "这个改动风险较大");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.comments).toHaveLength(1);
    expect(updated?.comments[0].transitionId).toBe(transition.id);
    expect(updated?.comments[0].content).toBe("这个改动风险较大");
  });

  it("removeTransition 删除流转记录后，该记录及其关联的评论都消失，其他记录和评论不受影响", async () => {
    const { createRequirement, transitionRequirement, addComment, removeTransition } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "需求 H");
    const created = useRequirementStore.getState().requirements[0];
    await transitionRequirement("proj-1", created.id, "need");
    await transitionRequirement("proj-1", created.id, "design");
    const [first, second] = useRequirementStore.getState().requirements[0].transitions;
    await addComment("proj-1", created.id, first.id, "第一条记录的评论");
    await addComment("proj-1", created.id, second.id, "第二条记录的评论");

    await removeTransition("proj-1", created.id, first.id);

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.transitions).toHaveLength(1);
    expect(updated?.transitions[0].id).toBe(second.id);
    expect(updated?.comments).toHaveLength(1);
    expect(updated?.comments[0].content).toBe("第二条记录的评论");
  });

  it("transitionRequirement 流转到发布阶段且未填写发布时间时，自动填入当前日期", async () => {
    const { createRequirement, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "verify", "需求 J");
    const created = useRequirementStore.getState().requirements[0];

    await transitionRequirement("proj-1", created.id, "release");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated ? releaseDateOf(updated) : undefined).toBe(new Date().toISOString().slice(0, 10));
  });

  it("transitionRequirement 流转到发布阶段但已手动填写发布时间时，不覆盖已有值", async () => {
    const { createRequirement, transitionRequirement, updateAttributeValue } = useRequirementStore.getState();
    await createRequirement("proj-1", "verify", "需求 K");
    const created = useRequirementStore.getState().requirements[0];
    await updateAttributeValue("proj-1", created.id, "release_date", "2026-08-01");

    await transitionRequirement("proj-1", created.id, "release");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated ? releaseDateOf(updated) : undefined).toBe("2026-08-01");
  });

  it("transitionRequirement 从归档恢复到活跃阶段时，progress 清零、closureType 清空", async () => {
    const { createRequirement, transitionRequirement, updateAttributeValue } = useRequirementStore.getState();
    await createRequirement("proj-1", "release", "需求 L");
    const created = useRequirementStore.getState().requirements[0];
    await updateAttributeValue("proj-1", created.id, "progress", 100);
    await transitionRequirement("proj-1", created.id, "archive");

    await transitionRequirement("proj-1", created.id, "dev");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.stage).toBe("dev");
    expect(updated ? resultOf(updated) : undefined).toBeNull();
    expect(updated ? progressOf(updated) : undefined).toBeNull();
  });

  it("重开应用后（loadForProject 重新读盘）流转记录、说明和评论原样还原", async () => {
    const { createRequirement, transitionRequirement, updateTransitionNote, addComment, loadForProject } =
      useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "需求 I");
    const created = useRequirementStore.getState().requirements[0];
    await transitionRequirement("proj-1", created.id, "need");
    const transition = useRequirementStore.getState().requirements[0].transitions[0];
    await updateTransitionNote("proj-1", created.id, transition.id, "补充说明");
    await addComment("proj-1", created.id, transition.id, "留个评论");

    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${created.id}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);
    await loadForProject("proj-1");

    const reloaded = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(reloaded?.transitions).toHaveLength(1);
    expect(reloaded?.transitions[0].note).toBe("补充说明");
    expect(reloaded?.comments).toHaveLength(1);
    expect(reloaded?.comments[0].content).toBe("留个评论");
  });

  it("没有 transitions/comments 字段的旧格式文件加载时不报错，两者都兜底为空数组", async () => {
    const { loadForProject } = useRequirementStore.getState();
    const legacyId = "legacy-req-4";
    files.set(
      `/app-local-data/projects/proj-1/${legacyId}.md`,
      "---\nid: legacy-req-4\nname: 旧需求\nstage: dev\npriority: P1\nsource: 内部想法\nassignee: ''\ndeadline: ''\nprogress: null\nclosureType: null\ncreatedAt: '2026-01-01T00:00:00.000Z'\ndeliverables: []\ntasks: []\nacceptance: []\n---\n\n旧正文",
    );
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${legacyId}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);

    await loadForProject("proj-1");

    const loaded = useRequirementStore.getState().requirements.find((r) => r.id === legacyId);
    expect(loaded?.transitions).toEqual([]);
    expect(loaded?.comments).toEqual([]);
    expect(loaded?.name).toBe("旧需求");
  });
});

describe("requirementStore manualOrder（手动排序）", () => {
  beforeEach(() => {
    files.clear();
    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
  });

  it("createRequirement 新建需求的 manualOrder 落到该阶段现有最小值之前（新建置顶）", async () => {
    const { createRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "第一条");
    const first = useRequirementStore.getState().requirements[0];
    expect(first.manualOrder).toBe(-1);

    await createRequirement("proj-1", "design", "第二条");
    const requirements = useRequirementStore.getState().requirements;
    const second = requirements.find((r) => r.name === "第二条");
    expect(second?.manualOrder).toBe(-2);
  });

  it("createRequirement 不同阶段的 manualOrder 互不影响", async () => {
    const { createRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "设计阶段需求");
    await createRequirement("proj-1", "dev", "开发阶段需求");

    const requirements = useRequirementStore.getState().requirements;
    expect(requirements.find((r) => r.name === "设计阶段需求")?.manualOrder).toBe(-1);
    expect(requirements.find((r) => r.name === "开发阶段需求")?.manualOrder).toBe(-1);
  });

  it("transitionRequirement 流转到新阶段后 manualOrder 落到目标阶段最小值之前，不沿用原阶段的值", async () => {
    const { createRequirement, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "dev", "已有的开发需求");
    const existing = useRequirementStore.getState().requirements[0];
    expect(existing.manualOrder).toBe(-1);

    await createRequirement("proj-1", "design", "待流转的设计需求");
    const moving = useRequirementStore.getState().requirements.find((r) => r.name === "待流转的设计需求")!;

    await transitionRequirement("proj-1", moving.id, "dev");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === moving.id);
    expect(updated?.manualOrder).toBe(-2);
  });

  it("transitionRequirement 流转到归档阶段时不重新计算 manualOrder（归档不参与手动排序）", async () => {
    const { createRequirement, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "release", "待归档需求");
    const created = useRequirementStore.getState().requirements[0];
    const originalOrder = created.manualOrder;

    await transitionRequirement("proj-1", created.id, "archive");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.manualOrder).toBe(originalOrder);
  });

  it("reorderManually 按传入更新落盘并更新 store 中对应需求的 manualOrder，不影响其他需求", async () => {
    const { createRequirement, reorderManually } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "需求 A");
    await createRequirement("proj-1", "design", "需求 B");
    const [a, b] = useRequirementStore.getState().requirements;

    await reorderManually("proj-1", [
      { requirementId: a.id, manualOrder: 5 },
      { requirementId: b.id, manualOrder: 6 },
    ]);

    const updated = useRequirementStore.getState().requirements;
    expect(updated.find((r) => r.id === a.id)?.manualOrder).toBe(5);
    expect(updated.find((r) => r.id === b.id)?.manualOrder).toBe(6);

    const filePath = `/app-local-data/projects/proj-1/${a.id}.md`;
    expect(files.get(filePath)).toContain("manualOrder: 5");
  });
});

describe("requirementStore Undo（REQ-027）", () => {
  beforeEach(() => {
    files.clear();
    undoStack.clear();
    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
  });

  it("属性修改、Tab 记录增删改和阶段流转可按逆序撤销", async () => {
    const { createRequirement, updateAttributeValue, addTabRecord, updateTabRecord, removeTabRecord, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "需求 A");
    const requirement = useRequirementStore.getState().requirements[0];

    await updateAttributeValue("proj-1", requirement.id, "priority", "P0");
    await addTabRecord("proj-1", requirement.id, "custom", { name: "记录" });
    const record = useRequirementStore.getState().requirements[0]?.tabRecords?.[0];
    if (!record) throw new Error("预期新建的 Tab 记录存在");
    await updateTabRecord("proj-1", requirement.id, record.id, { name: "已修改记录" });
    await removeTabRecord("proj-1", requirement.id, record.id);
    await transitionRequirement("proj-1", requirement.id, "need");

    expect(undoStack.size).toBe(5);
    await expect(undoStack.undo()).resolves.toBe("流转阶段");
    expect(useRequirementStore.getState().requirements[0].stage).toBe("collect");
    await expect(undoStack.undo()).resolves.toBe("删除 Tab 记录");
    const afterRestore = useRequirementStore.getState().requirements[0];
    expect(afterRestore?.tabRecords).toHaveLength(1);
    expect(afterRestore?.tabRecords?.[0]?.fieldValues.name).toBe("已修改记录");
    await expect(undoStack.undo()).resolves.toBe("修改 Tab 记录");
    expect(useRequirementStore.getState().requirements[0]?.tabRecords?.[0]?.fieldValues.name).toBe("记录");
    await expect(undoStack.undo()).resolves.toBe("新建 Tab 记录");
    expect(useRequirementStore.getState().requirements[0].tabRecords).toHaveLength(0);
    await expect(undoStack.undo()).resolves.toBe("修改属性");
    expect(useRequirementStore.getState().requirements[0].attributeValues.priority).toBe("P2");
  });

  it("属性结构变更会清空 Undo 栈，避免旧快照把已删除字段写回", async () => {
    const { createRequirement, updateAttributeValue, cascadeAttributeChange } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "需求 B");
    const requirement = useRequirementStore.getState().requirements[0];
    await updateAttributeValue("proj-1", requirement.id, "priority", "P0");
    await cascadeAttributeChange("proj-1", "priority", () => undefined);

    expect(undoStack.size).toBe(0);
    await expect(undoStack.undo()).resolves.toBeNull();
    expect(useRequirementStore.getState().requirements[0].attributeValues.priority).toBeUndefined();
  });

  it("结构操作开始后，先前尚在落盘的属性修改不能把旧快照重新推入 Undo 栈", async () => {
    const { createRequirement, updateAttributeValue, cascadeAttributeChange } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "需求竞态");
    const requirement = useRequirementStore.getState().requirements[0];

    const pendingUpdate = updateAttributeValue("proj-1", requirement.id, "priority", "P0");
    const pendingCascade = cascadeAttributeChange("proj-1", "priority", () => undefined);
    await Promise.all([pendingUpdate, pendingCascade]);

    expect(undoStack.size).toBe(0);
    expect(useRequirementStore.getState().requirements[0].attributeValues.priority).toBeUndefined();
  });

  it("手动排序撤销后恢复所有受影响需求的顺序", async () => {
    const { createRequirement, reorderManually } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "需求 A");
    await createRequirement("proj-1", "design", "需求 B");
    const [first, second] = useRequirementStore.getState().requirements;

    const undoStageSort = vi.fn(async () => undefined);
    await reorderManually("proj-1", [
      { requirementId: first.id, manualOrder: 8 },
      { requirementId: second.id, manualOrder: 9 },
    ], undoStageSort);
    await undoStack.undo();

    const restored = useRequirementStore.getState().requirements;
    expect(restored.find((item) => item.id === first.id)?.manualOrder).toBe(first.manualOrder);
    expect(restored.find((item) => item.id === second.id)?.manualOrder).toBe(second.manualOrder);
    expect(undoStageSort).toHaveBeenCalledOnce();
  });

  it("连续异步修改不同属性时按调用顺序合并，而不是用旧快照互相覆盖", async () => {
    const { createRequirement, updateAttributeValue } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "需求 C");
    const requirement = useRequirementStore.getState().requirements[0];

    await Promise.all([
      updateAttributeValue("proj-1", requirement.id, "priority", "P0"),
      updateAttributeValue("proj-1", requirement.id, "source", "用户反馈"),
    ]);

    const updated = useRequirementStore.getState().requirements[0];
    expect(updated.attributeValues.priority).toBe("P0");
    expect(updated.attributeValues.source).toBe("用户反馈");
    expect(undoStack.size).toBe(2);
  });

  it("Undo 与已发起但未完成的新编辑共用队列，不会覆盖新编辑之前的状态", async () => {
    const { createRequirement, updateAttributeValue } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "需求并发撤销");
    const requirement = useRequirementStore.getState().requirements[0];
    await updateAttributeValue("proj-1", requirement.id, "priority", "P0");

    const pendingChange = updateAttributeValue("proj-1", requirement.id, "source", "用户反馈");
    const pendingUndo = undoStack.undo();
    await Promise.all([pendingChange, pendingUndo]);

    const updated = useRequirementStore.getState().requirements[0];
    expect(updated.attributeValues.priority).toBe("P0");
    expect(updated.attributeValues.source).toBe("内部想法");
  });

  it("切换项目时清空 Undo 栈，避免撤销命令修改不可见的旧项目", async () => {
    const { createRequirement, updateAttributeValue, loadForProject } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "需求 D");
    const requirement = useRequirementStore.getState().requirements[0];
    await updateAttributeValue("proj-1", requirement.id, "priority", "P0");

    await loadForProject("proj-2");

    expect(undoStack.size).toBe(0);
    await expect(undoStack.undo()).resolves.toBeNull();
  });
});

describe("requirementStore.cascadeAttributeChange（Phase 18：改类型/删属性的批量级联）", () => {
  beforeEach(() => {
    files.clear();
    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
  });

  it("对填了该属性值的需求应用 transform 并落盘，未填值的需求不受影响", async () => {
    const { createRequirement, updateAttributeValue, cascadeAttributeChange } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "需求 A");
    await createRequirement("proj-1", "design", "需求 B");
    const [a, b] = useRequirementStore.getState().requirements;
    await updateAttributeValue("proj-1", a.id, "custom", "旧值");

    await cascadeAttributeChange("proj-1", "custom", () => "新值");

    const updated = useRequirementStore.getState().requirements;
    expect(updated.find((r) => r.id === a.id)?.attributeValues.custom).toBe("新值");
    expect(updated.find((r) => r.id === b.id)?.attributeValues.custom).toBeUndefined();

    const raw = files.get(`/app-local-data/projects/proj-1/${a.id}.md`) ?? "";
    expect(raw).toContain("新值");
  });

  it("transform 返回 undefined 时（删属性场景）该属性值从记录中清空", async () => {
    const { createRequirement, updateAttributeValue, cascadeAttributeChange } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "需求 A");
    const created = useRequirementStore.getState().requirements[0];
    await updateAttributeValue("proj-1", created.id, "custom", "值");

    await cascadeAttributeChange("proj-1", "custom", () => undefined);

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.attributeValues.custom).toBeUndefined();
  });

  it("没有需求填过该属性时不触发任何落盘", async () => {
    const { createRequirement, cascadeAttributeChange } = useRequirementStore.getState();
    await createRequirement("proj-1", "design", "需求 A");
    const created = useRequirementStore.getState().requirements[0];
    const before = files.get(`/app-local-data/projects/proj-1/${created.id}.md`);

    await cascadeAttributeChange("proj-1", "never_set", () => "新值");

    expect(files.get(`/app-local-data/projects/proj-1/${created.id}.md`)).toBe(before);
  });
});

describe("requirementStore Phase 26 生命周期", () => {
  beforeEach(() => {
    files.clear();
    undoStack.clear();
    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
  });

  it("永久删除实体时移除 Markdown 文件，连同内嵌 Tab 记录、流转记录和评论一起消失", async () => {
    const { addComment, addTabRecord, createRequirement, deleteRequirement, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "待删除实体");
    const created = useRequirementStore.getState().requirements[0];
    await addTabRecord("proj-1", created.id, "custom", { name: "关联记录" });
    await transitionRequirement("proj-1", created.id, "need");
    await addComment("proj-1", created.id, useRequirementStore.getState().requirements[0].transitions[0].id, "关联评论");

    expect(useRequirementStore.getState().requirements[0]).toMatchObject({ tabRecords: [{ tabId: "custom" }] });
    expect(useRequirementStore.getState().requirements[0].transitions).toHaveLength(1);
    expect(useRequirementStore.getState().requirements[0].comments).toHaveLength(1);

    await deleteRequirement("proj-1", created.id);

    expect(useRequirementStore.getState().requirements).toEqual([]);
    expect(files.has(`/app-local-data/projects/proj-1/${created.id}.md`)).toBe(false);
    expect(undoStack.size).toBe(0);
  });

  it("删除阶段前为所有历史流转写入显示名快照并落盘", async () => {
    const { createRequirement, freezeStageHistory, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "collect", "历史实体");
    const created = useRequirementStore.getState().requirements[0];
    await transitionRequirement("proj-1", created.id, "review");

    await freezeStageHistory("proj-1", { id: "review", label: "方案评审", color: "#5D3A73", isTerminal: false });

    const transition = useRequirementStore.getState().requirements[0].transitions[0];
    expect(transition.toLabel).toBe("方案评审");
    expect(files.get(`/app-local-data/projects/proj-1/${created.id}.md`)).toContain("方案评审");
  });
});

describe("requirementStore 加载 Phase 15 之前的旧格式文件（无 attributeValues）", () => {
  beforeEach(() => {
    files.clear();
    useRequirementStore.setState({ requirements: [], loadedProjectId: null, loading: false, error: false });
  });

  it("旧格式扁平字段现场映射为 attributeValues，closureType 映射为 result，数据不丢（REQ-029）", async () => {
    const { loadForProject } = useRequirementStore.getState();
    const legacyId = "legacy-archived";
    files.set(
      `/app-local-data/projects/proj-1/${legacyId}.md`,
      "---\nid: legacy-archived\nname: 旧归档需求\nstage: archive\npriority: P0\nsource: 用户反馈\nassignee: 吴桐\ndeadline: '2026-06-01'\nprogress: 100\nclosureType: abandoned\ncreatedAt: '2026-01-01T00:00:00.000Z'\nreleaseMethod: 全量\nreleaseDate: '2026-05-01'\nmanualOrder: 0\ndeliverables: []\ntasks: []\nacceptance: []\ntransitions: []\ncomments: []\n---\n\n旧正文",
    );
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${legacyId}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);

    await loadForProject("proj-1");

    const loaded = useRequirementStore.getState().requirements.find((r) => r.id === legacyId);
    expect(loaded?.name).toBe("旧归档需求");
    expect(resultOf(loaded!)).toBe("abandoned");
    expect(loaded?.attributeValues).toMatchObject({
      priority: "P0",
      source: "用户反馈",
      assignee: "吴桐",
      deadline: "2026-06-01",
      progress: 100,
      release_method: "全量",
      release_date: "2026-05-01",
      result: "abandoned",
    });
  });

  it("旧格式文件重新落盘（如编辑一次）后写出新格式（含 attributeValues），不再是扁平字段", async () => {
    const { loadForProject, renameRequirement } = useRequirementStore.getState();
    const legacyId = "legacy-to-resave";
    files.set(
      `/app-local-data/projects/proj-1/${legacyId}.md`,
      "---\nid: legacy-to-resave\nname: 旧需求\nstage: verify\npriority: P1\nsource: 内部想法\nassignee: ''\ndeadline: ''\nprogress: null\nclosureType: null\ncreatedAt: '2026-01-01T00:00:00.000Z'\nreleaseMethod: ''\nreleaseDate: ''\nmanualOrder: 0\ndeliverables: []\ntasks: []\nacceptance: []\ntransitions: []\ncomments: []\n---\n\n正文",
    );
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: `${legacyId}.md`, isFile: true, isDirectory: false, isSymlink: false },
    ] as never);
    await loadForProject("proj-1");

    await renameRequirement("proj-1", legacyId, "改名后的需求");

    const raw = files.get(`/app-local-data/projects/proj-1/${legacyId}.md`) ?? "";
    expect(raw).toContain("attributeValues:");
    expect(raw).not.toContain("closureType");
  });
});

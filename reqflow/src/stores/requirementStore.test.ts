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
    expect(updated?.closureType).toBeNull();
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
    expect(updated?.closureType).toBeNull();
  });

  it("transitionRequirement 流转到归档（正常完成路径）时 closureType 设为 completed", async () => {
    const { createRequirement, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "release", "需求 C");
    const created = useRequirementStore.getState().requirements[0];

    await transitionRequirement("proj-1", created.id, "archive");

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.stage).toBe("archive");
    expect(updated?.closureType).toBe("completed");
    expect(updated?.transitions[0].to).toBe("archive");
  });

  it("transitionRequirement 传 abandoned 选项时，不论目标阶段是什么都直接归档且 closureType 为 abandoned", async () => {
    const { createRequirement, transitionRequirement } = useRequirementStore.getState();
    await createRequirement("proj-1", "dev", "需求 D");
    const created = useRequirementStore.getState().requirements[0];

    await transitionRequirement("proj-1", created.id, "dev", { abandoned: true });

    const updated = useRequirementStore.getState().requirements.find((r) => r.id === created.id);
    expect(updated?.stage).toBe("archive");
    expect(updated?.closureType).toBe("abandoned");
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

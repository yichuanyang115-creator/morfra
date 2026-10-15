import { beforeEach, describe, expect, it, vi } from "vitest";
import { morfraTemplateSnapshot } from "../lib/schemaDefaults";

const files = new Map<string, string>();

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => {
    if (files.has(path)) return true;
    return [...files.keys()].some((filePath) => filePath.startsWith(`${path}/`));
  }),
  mkdir: vi.fn(async () => undefined),
  readDir: vi.fn(async (path: string) => {
    const names = [...files.keys()]
      .filter((filePath) => filePath.startsWith(`${path}/`))
      .map((filePath) => filePath.slice(path.length + 1))
      .filter((name) => !name.includes("/"));
    return names.map((name) => ({ name, isFile: true, isDirectory: false, isSymlink: false }));
  }),
  readTextFile: vi.fn(async (path: string) => files.get(path) ?? ""),
  writeTextFile: vi.fn(async (path: string, content: string) => {
    files.set(path, content);
  }),
  remove: vi.fn(async (path: string) => {
    for (const filePath of [...files.keys()]) {
      if (filePath === path || filePath.startsWith(`${path}/`)) files.delete(filePath);
    }
  }),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "/app-local-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

const { useProjectStore } = await import("./projectStore");
const { useTemplateStore } = await import("./templateStore");

describe("projectStore.init 错误处理", () => {
  beforeEach(() => {
    files.clear();
    useProjectStore.setState({ projects: [], currentProjectId: null, loaded: false, initializing: false, error: false });
    useTemplateStore.setState({ templates: [], loaded: false, loading: false, error: null });
  });

  it("项目根目录列出失败时，error 置为 true（不停留在白屏无提示状态）", async () => {
    // exists() 靠 files map 判断路径是否存在，先放一个文件让根目录判定为"已存在"，
    // 这样 listDirNames 才会真正走到 readDir 这一步
    files.set("/app-local-data/projects/some-project/_project.md", "---\nid: x\nname: x\n---\n");
    const { readDir } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockRejectedValueOnce(new Error("disk error"));

    const { init } = useProjectStore.getState();
    await init();

    const state = useProjectStore.getState();
    expect(state.error).toBe(true);
    expect(state.loaded).toBe(false);
    expect(state.initializing).toBe(false);
  });

  it("单个项目元数据文件解析失败不影响其余项目正常加载，坏项目被跳过", async () => {
    files.set("/app-local-data/projects/proj-good/_project.md", "---\nid: proj-good\nname: 正常项目\n---\n");

    const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readDir).mockResolvedValueOnce([
      { name: "proj-good", isFile: false, isDirectory: true, isSymlink: false },
      { name: "proj-broken", isFile: false, isDirectory: true, isSymlink: false },
    ] as never);

    const brokenMetaPath = "/app-local-data/projects/proj-broken/_project.md";
    const original = vi.mocked(readTextFile).getMockImplementation()!;
    vi.mocked(readTextFile).mockImplementation(async (path) => {
      if (path === brokenMetaPath) throw new Error("parse error");
      return original(path);
    });
    files.set(brokenMetaPath, "---\nid: [ 没有闭合\n---\n");

    const { init } = useProjectStore.getState();
    await init();

    const state = useProjectStore.getState();
    expect(state.error).toBe(false);
    expect(state.loaded).toBe(true);
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0].id).toBe("proj-good");

    vi.mocked(readTextFile).mockImplementation(original);
  });
});

describe("projectStore CRUD（REQ-018/FLOW-009 多项目管理）", () => {
  beforeEach(() => {
    files.clear();
    useProjectStore.setState({ projects: [], currentProjectId: null, loaded: false, initializing: false, error: false });
    useTemplateStore.setState({ templates: [], loaded: false, loading: false, error: null });
  });

  it("createProject 新建项目后自动切换到该项目，且落盘 _project.md", async () => {
    const { createProject } = useProjectStore.getState();
    await createProject("新项目");

    const state = useProjectStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0].name).toBe("新项目");
    expect(state.currentProjectId).toBe(state.projects[0].id);

    const metaPath = `/app-local-data/projects/${state.projects[0].id}/_project.md`;
    expect(files.get(metaPath)).toContain("新项目");
  });

  it("不选模板创建空白项目，选模板时复制 Schema 结构并重置视图偏好", async () => {
    const { createProject } = useProjectStore.getState();
    await createProject("空白项目");
    const blank = useProjectStore.getState().projects[0];
    const blankSchema = JSON.parse(files.get(`/app-local-data/projects/${blank.id}/schema.json`) ?? "{}") as { stageOptions: unknown[]; attributes: unknown[]; tabs: unknown[] };
    expect(blankSchema.stageOptions).toHaveLength(1);
    expect(blankSchema.attributes).toHaveLength(0);
    expect(blankSchema.tabs).toHaveLength(0);

    await createProject("模板项目", { id: "morfra", name: "需求管理模板", schemaSnapshot: morfraTemplateSnapshot() });
    const templated = useProjectStore.getState().projects[1];
    const schema = JSON.parse(files.get(`/app-local-data/projects/${templated.id}/schema.json`) ?? "{}") as { stageOptions: unknown[]; viewPreferences: { columnWidths: Record<string, number> } };
    expect(schema.stageOptions).toHaveLength(7);
    expect(schema.viewPreferences.columnWidths).toEqual({});
  });

  it("switchProject 切换到列表中存在的项目 id", async () => {
    const { createProject, switchProject } = useProjectStore.getState();
    await createProject("项目甲");
    await createProject("项目乙");

    const [first] = useProjectStore.getState().projects;
    switchProject(first.id);

    expect(useProjectStore.getState().currentProjectId).toBe(first.id);
  });

  it("switchProject 传入不存在的 id 时不改变当前项目（边界：目标项目已被删除）", async () => {
    const { createProject, switchProject } = useProjectStore.getState();
    await createProject("项目甲");
    const currentId = useProjectStore.getState().currentProjectId;

    switchProject("not-exist-id");

    expect(useProjectStore.getState().currentProjectId).toBe(currentId);
  });

  it("renameProject 改名后落盘且内存态同步更新，其余字段不变", async () => {
    const { createProject, renameProject } = useProjectStore.getState();
    await createProject("旧名字");
    const id = useProjectStore.getState().projects[0].id;

    await renameProject(id, "新名字");

    const project = useProjectStore.getState().projects.find((p) => p.id === id);
    expect(project?.name).toBe("新名字");
    const metaPath = `/app-local-data/projects/${id}/_project.md`;
    expect(files.get(metaPath)).toContain("新名字");
  });

  it("deleteProject 删除后切换到列表第一个项目（FLOW-009 边界情况）", async () => {
    const { createProject, deleteProject } = useProjectStore.getState();
    await createProject("项目甲");
    await createProject("项目乙");
    const [first, second] = useProjectStore.getState().projects;
    // 当前应指向最后创建的"项目乙"（second），删除它后应切回列表第一个（first）
    expect(useProjectStore.getState().currentProjectId).toBe(second.id);

    await deleteProject(second.id);

    const state = useProjectStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0].id).toBe(first.id);
    expect(state.currentProjectId).toBe(first.id);
  });

  it("删除来源项目不删除应用级模板，重新加载后模板仍可使用（REQ-028）", async () => {
    await useTemplateStore.getState().load();
    const template = useTemplateStore.getState().templates[0];
    const { createProject, deleteProject } = useProjectStore.getState();
    await createProject("来源项目", template);
    const sourceProject = useProjectStore.getState().projects[0];
    await createProject("保留项目");

    await deleteProject(sourceProject.id);
    useTemplateStore.setState({ templates: [], loaded: false });
    await useTemplateStore.getState().load();

    expect(useTemplateStore.getState().templates.some((item) => item.id === template.id)).toBe(true);
    expect([...files.keys()].some((path) => path.includes(`/projects/${sourceProject.id}/`))).toBe(false);
  });

  it("deleteProject 只有一个项目时拒绝删除（不落盘删除、不改变状态）", async () => {
    const { createProject, deleteProject } = useProjectStore.getState();
    await createProject("唯一项目");
    const only = useProjectStore.getState().projects[0];

    await deleteProject(only.id);

    const state = useProjectStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0].id).toBe(only.id);
  });

});

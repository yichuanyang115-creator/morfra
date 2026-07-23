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

const { useProjectStore } = await import("./projectStore");

describe("projectStore.init 错误处理", () => {
  beforeEach(() => {
    files.clear();
    useProjectStore.setState({ projects: [], currentProjectId: null, loaded: false, initializing: false, error: false });
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

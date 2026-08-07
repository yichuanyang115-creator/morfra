import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultTheme } from "../lib/themeDefaults";

const { files, writeTextFileMock } = vi.hoisted(() => {
  const fileStore = new Map<string, string>();
  const writeMock = vi.fn(async (path: string, content: string) => {
    fileStore.set(path, content);
  });
  return { files: fileStore, writeTextFileMock: writeMock };
});

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => files.has(path)),
  readTextFile: vi.fn(async (path: string) => files.get(path) ?? ""),
  writeTextFile: writeTextFileMock,
}));

vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "/app-local-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

const { useThemeStore } = await import("./themeStore");
const THEME_PATH = "/app-local-data/theme.json";

describe("themeStore", () => {
  beforeEach(() => {
    files.clear();
    writeTextFileMock.mockClear().mockImplementation(async (path: string, content: string) => {
      files.set(path, content);
    });
    useThemeStore.setState({
      appliedTheme: createDefaultTheme(),
      draftTheme: null,
      draftIssues: [],
      loaded: false,
      recoveryNotice: null,
    });
  });

  it("首次启动不存在 theme.json 时使用默认主题且不报错", async () => {
    await useThemeStore.getState().load();

    const state = useThemeStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.recoveryNotice).toBeNull();
    expect(state.appliedTheme.palette.ink).toBe("#2B2421");
  });

  it("保存后重新加载会恢复同一份应用级配置", async () => {
    const config = createDefaultTheme();
    config.palette.green500 = "#4F9200";

    expect(await useThemeStore.getState().save(config)).toBe(true);
    expect(files.get(THEME_PATH)).toContain("#4F9200");

    useThemeStore.setState({ appliedTheme: createDefaultTheme(), loaded: false });
    await useThemeStore.getState().load();
    expect(useThemeStore.getState().appliedTheme.palette.green500).toBe("#4F9200");
  });

  it("损坏 JSON 时回退默认主题并给出非阻断提示", async () => {
    files.set(THEME_PATH, "{ this is not json");

    await useThemeStore.getState().load();

    const state = useThemeStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.appliedTheme).toEqual(createDefaultTheme());
    expect(state.recoveryNotice).toBe("外观配置读取失败，已恢复默认主题");
  });

  it("版本不兼容时不读取成应用主题，也不影响已有数据文件", async () => {
    files.set(THEME_PATH, JSON.stringify({ ...createDefaultTheme(), version: 2 }));
    files.set("/app-local-data/projects/project-a/schema.json", '{"version":1}');

    await useThemeStore.getState().load();

    expect(useThemeStore.getState().appliedTheme).toEqual(createDefaultTheme());
    expect(useThemeStore.getState().recoveryNotice).toBe("外观配置无效，已恢复默认主题");
    expect(files.get("/app-local-data/projects/project-a/schema.json")).toBe('{"version":1}');
  });

  it("进入设置后复制草稿，编辑草稿不提前改全局主题或磁盘", () => {
    const before = useThemeStore.getState().appliedTheme.palette.green500;

    useThemeStore.getState().beginDraft();
    useThemeStore.getState().updateDraft((theme) => ({
      ...theme,
      semantic: { ...theme.semantic, actionBase: "#4F9200" },
    }));

    expect(useThemeStore.getState().draftTheme?.semantic.actionBase).toBe("#4F9200");
    expect(useThemeStore.getState().appliedTheme.palette.green500).toBe(before);
    expect(files.size).toBe(0);
  });

  it("非法草稿阻止应用并返回字段错误，恢复默认后才可应用", async () => {
    useThemeStore.getState().beginDraft();
    useThemeStore.getState().updateDraft((theme) => ({
      ...theme,
      semantic: { ...theme.semantic, textPrimary: "#FFFFFF" },
    }));

    expect(await useThemeStore.getState().applyDraft()).toBe(false);
    expect(useThemeStore.getState().draftIssues.some((issue) => issue.field === "semantic.textPrimary")).toBe(true);
    expect(files.size).toBe(0);

    useThemeStore.getState().resetDraft();
    expect(await useThemeStore.getState().applyDraft()).toBe(true);
    expect(files.get(THEME_PATH)).toContain("\"version\": 1");
  });

  it("主题文件保存失败时保留草稿并返回可重试错误", async () => {
    useThemeStore.getState().beginDraft();
    writeTextFileMock.mockRejectedValueOnce(new Error("disk full"));

    expect(await useThemeStore.getState().applyDraft()).toBe(false);
    expect(useThemeStore.getState().draftTheme).not.toBeNull();
    expect(useThemeStore.getState().draftIssues).toEqual([
      { field: "theme", message: "主题保存失败，请重试" },
    ]);
  });

  it("模块默认不落盘，启用后只保存显式覆盖，恢复跟随后删除整个模块键", async () => {
    useThemeStore.getState().beginDraft();
    useThemeStore.getState().enableModuleOverride("board", ["contextSoft", "actionBase"]);
    useThemeStore.getState().updateModuleOverride("board", "contextSoft", "purple100");

    expect(useThemeStore.getState().draftTheme?.moduleOverrides).toEqual({
      board: { contextSoft: "purple100", actionBase: "green500" },
    });
    expect(await useThemeStore.getState().applyDraft()).toBe(true);
    const persisted = JSON.parse(files.get(THEME_PATH) ?? "{}") as { moduleOverrides?: unknown };
    expect(persisted.moduleOverrides).toEqual({ board: { contextSoft: "purple100", actionBase: "green500" } });

    useThemeStore.setState({ appliedTheme: createDefaultTheme(), draftTheme: null, loaded: false });
    await useThemeStore.getState().load();
    expect(useThemeStore.getState().appliedTheme.moduleOverrides.board).toEqual({
      contextSoft: "purple100",
      actionBase: "green500",
    });
    useThemeStore.getState().beginDraft();

    useThemeStore.getState().clearModuleOverride("board");
    expect(useThemeStore.getState().draftTheme?.moduleOverrides).toEqual({});
    expect(await useThemeStore.getState().applyDraft()).toBe(true);
    expect(JSON.parse(files.get(THEME_PATH) ?? "{}").moduleOverrides).toEqual({});

    useThemeStore.setState({ appliedTheme: createDefaultTheme(), draftTheme: null, loaded: false });
    await useThemeStore.getState().load();
    expect(useThemeStore.getState().appliedTheme.moduleOverrides).toEqual({});
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultTheme } from "../lib/themeDefaults";

const files = new Map<string, string>();

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => files.has(path)),
  readTextFile: vi.fn(async (path: string) => files.get(path) ?? ""),
  writeTextFile: vi.fn(async (path: string, content: string) => {
    files.set(path, content);
  }),
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
    useThemeStore.setState({
      appliedTheme: createDefaultTheme(),
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
});

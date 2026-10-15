import { beforeEach, describe, expect, it, vi } from "vitest";

const getVersionMock = vi.fn();
const openPathMock = vi.fn();
const downloadMock = vi.fn();
const checkForUpdateMock = vi.fn();
const pathExistsMock = vi.fn();
const removeFileMock = vi.fn();
const joinMock = vi.fn();

vi.mock("@tauri-apps/api/app", () => ({ getVersion: getVersionMock }));
vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn().mockResolvedValue("/fake/appdata"),
  join: joinMock,
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openPath: openPathMock }));
vi.mock("@tauri-apps/plugin-upload", () => ({ download: downloadMock }));
vi.mock("../lib/updater", () => ({ checkForUpdate: checkForUpdateMock }));
vi.mock("../lib/fs", () => ({ pathExists: pathExistsMock, removeFile: removeFileMock }));

const { useUpdateStore } = await import("./updateStore");

describe("updateStore", () => {
  beforeEach(() => {
    getVersionMock.mockReset();
    openPathMock.mockReset();
    downloadMock.mockReset();
    checkForUpdateMock.mockReset();
    pathExistsMock.mockReset();
    removeFileMock.mockReset();
    joinMock.mockReset().mockImplementation(async (...parts: string[]) => parts.join("/"));
    useUpdateStore.setState({
      status: "idle",
      currentVersion: "",
      release: null,
      downloadProgress: 0,
      errorMessage: "",
    });
  });

  it("loadVersion 从 getVersion 拿到当前 package 版本号写入 store", async () => {
    getVersionMock.mockResolvedValueOnce("0.1.0");
    await useUpdateStore.getState().loadVersion();
    expect(useUpdateStore.getState().currentVersion).toBe("0.1.0");
  });

  it("loadVersion 失败时进入 error 状态并保留可重试错误", async () => {
    getVersionMock.mockRejectedValueOnce(new Error("版本读取失败"));

    await useUpdateStore.getState().loadVersion();

    expect(useUpdateStore.getState().status).toBe("error");
    expect(useUpdateStore.getState().errorMessage).toBe("版本读取失败");
  });

  it("checkUpdate 查到已是最新版本时状态变为 up-to-date，不带 release 信息", async () => {
    checkForUpdateMock.mockResolvedValueOnce({ hasUpdate: false });
    await useUpdateStore.getState().checkUpdate();
    const state = useUpdateStore.getState();
    expect(state.status).toBe("up-to-date");
    expect(state.release).toBeNull();
  });

  it("checkUpdate 查到有新版本时状态变为 available 并存下 release 信息", async () => {
    const release = { version: "v0.2.0", notes: "新特性", assetUrl: "https://x/y.dmg" };
    checkForUpdateMock.mockResolvedValueOnce({ hasUpdate: true, release });
    await useUpdateStore.getState().checkUpdate();
    const state = useUpdateStore.getState();
    expect(state.status).toBe("available");
    expect(state.release).toEqual(release);
  });

  it("checkUpdate 请求失败时状态变为 error 并记录错误信息，供面板内联展示", async () => {
    checkForUpdateMock.mockRejectedValueOnce(new Error("GitHub API 请求失败（503）"));
    await useUpdateStore.getState().checkUpdate();
    const state = useUpdateStore.getState();
    expect(state.status).toBe("error");
    expect(state.errorMessage).toBe("GitHub API 请求失败（503）");
  });

  it("downloadUpdate 下载成功后打开 dmg 并把状态收回 up-to-date", async () => {
    useUpdateStore.setState({
      release: { version: "v0.2.0", notes: "", assetUrl: "https://x/y.dmg" },
    });
    downloadMock.mockImplementationOnce(async (_url, _path, onProgress) => {
      onProgress?.({ progress: 50, progressTotal: 50, total: 100, transferSpeed: 0 });
    });

    await useUpdateStore.getState().downloadUpdate();

    expect(downloadMock).toHaveBeenCalled();
    expect(openPathMock).toHaveBeenCalledWith("/fake/appdata/morfra-update.dmg");
    expect(useUpdateStore.getState().status).toBe("up-to-date");
    expect(useUpdateStore.getState().downloadProgress).toBe(50);
  });

  it("downloadUpdate 中途失败时清理残片文件并把状态设为 error，不调用 openPath", async () => {
    useUpdateStore.setState({
      release: { version: "v0.2.0", notes: "", assetUrl: "https://x/y.dmg" },
    });
    downloadMock.mockRejectedValueOnce(new Error("connection reset"));
    pathExistsMock.mockResolvedValueOnce(true);

    await useUpdateStore.getState().downloadUpdate();

    expect(removeFileMock).toHaveBeenCalledWith("/fake/appdata/morfra-update.dmg");
    expect(openPathMock).not.toHaveBeenCalled();
    const state = useUpdateStore.getState();
    expect(state.status).toBe("error");
    expect(state.errorMessage).toBe("connection reset");
  });

  it("downloadUpdate 失败但残片文件不存在时不调用清理，仍进入 error 状态", async () => {
    useUpdateStore.setState({
      release: { version: "v0.2.0", notes: "", assetUrl: "https://x/y.dmg" },
    });
    downloadMock.mockRejectedValueOnce(new Error("timeout"));
    pathExistsMock.mockResolvedValueOnce(false);

    await useUpdateStore.getState().downloadUpdate();

    expect(removeFileMock).not.toHaveBeenCalled();
    expect(useUpdateStore.getState().status).toBe("error");
  });

  it("下载目标路径解析失败时也进入 error 状态并可重试", async () => {
    useUpdateStore.setState({
      release: { version: "v0.2.0", notes: "", assetUrl: "https://x/y.dmg" },
    });
    joinMock.mockRejectedValueOnce(new Error("路径解析失败"));

    await useUpdateStore.getState().downloadUpdate();

    expect(downloadMock).not.toHaveBeenCalled();
    expect(useUpdateStore.getState().status).toBe("error");
    expect(useUpdateStore.getState().errorMessage).toBe("路径解析失败");
  });
});

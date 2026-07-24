import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const getVersionMock = vi.fn();
const openPathMock = vi.fn();
const downloadMock = vi.fn();
const checkForUpdateMock = vi.fn();

vi.mock("@tauri-apps/api/app", () => ({ getVersion: getVersionMock }));
vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn().mockResolvedValue("/fake/appdata"),
  join: (...parts: string[]) => Promise.resolve(parts.join("/")),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openPath: openPathMock }));
vi.mock("@tauri-apps/plugin-upload", () => ({ download: downloadMock }));
vi.mock("../../lib/updater", () => ({ checkForUpdate: checkForUpdateMock }));
vi.mock("../../lib/fs", () => ({ pathExists: vi.fn().mockResolvedValue(false), removeFile: vi.fn() }));

const { useUpdateStore } = await import("../../stores/updateStore");
const { SettingsPanel } = await import("./SettingsPanel");

describe("SettingsPanel（REQ-023 检查更新）", () => {
  beforeEach(() => {
    getVersionMock.mockReset().mockResolvedValue("0.1.0");
    openPathMock.mockReset();
    downloadMock.mockReset();
    checkForUpdateMock.mockReset();
    useUpdateStore.setState({
      status: "idle",
      currentVersion: "",
      release: null,
      downloadProgress: 0,
      errorMessage: "",
    });
  });

  it("打开面板后展示当前应用版本号", async () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    expect(await screen.findByText("v0.1.0")).toBeInTheDocument();
  });

  it("点击检查更新且无新版本时提示已是最新版本", async () => {
    checkForUpdateMock.mockResolvedValueOnce({ hasUpdate: false });
    render(<SettingsPanel onClose={vi.fn()} />);

    await userEvent.click(await screen.findByText("检查更新"));

    expect(await screen.findByText("已是最新版本")).toBeInTheDocument();
  });

  it("点击检查更新查到新版本时展示版本号、更新说明和下载按钮", async () => {
    checkForUpdateMock.mockResolvedValueOnce({
      hasUpdate: true,
      release: { version: "v0.2.0", notes: "修复了若干问题", assetUrl: "https://x/y.dmg" },
    });
    render(<SettingsPanel onClose={vi.fn()} />);

    await userEvent.click(await screen.findByText("检查更新"));

    expect(await screen.findByText("发现新版本 v0.2.0")).toBeInTheDocument();
    expect(screen.getByText("修复了若干问题")).toBeInTheDocument();
    expect(screen.getByText("下载更新")).toBeInTheDocument();
  });

  it("检查更新遇网络错误时面板内联提示，不弹系统对话框，可重新点击重试", async () => {
    checkForUpdateMock.mockRejectedValueOnce(new Error("GitHub API 请求失败（503）"));
    checkForUpdateMock.mockResolvedValueOnce({ hasUpdate: false });
    render(<SettingsPanel onClose={vi.fn()} />);

    await userEvent.click(await screen.findByText("检查更新"));
    expect(await screen.findByText("GitHub API 请求失败（503）")).toBeInTheDocument();

    await userEvent.click(screen.getByText("重试"));
    expect(await screen.findByText("已是最新版本")).toBeInTheDocument();
  });

  it("点击下载更新后展示下载进度，下载完成后自动打开 dmg", async () => {
    checkForUpdateMock.mockResolvedValueOnce({
      hasUpdate: true,
      release: { version: "v0.2.0", notes: "", assetUrl: "https://x/y.dmg" },
    });
    downloadMock.mockImplementationOnce(async (_url, _path, onProgress) => {
      onProgress?.({ progress: 100, progressTotal: 100, total: 100, transferSpeed: 0 });
    });
    render(<SettingsPanel onClose={vi.fn()} />);

    await userEvent.click(await screen.findByText("检查更新"));
    await userEvent.click(await screen.findByText("下载更新"));

    expect(openPathMock).toHaveBeenCalledWith("/fake/appdata/reqflow-update.dmg");
    expect(await screen.findByText("已是最新版本")).toBeInTheDocument();
  });

  it("下载中途失败时面板内联提示下载失败，可重新点击手动重试", async () => {
    checkForUpdateMock.mockResolvedValueOnce({
      hasUpdate: true,
      release: { version: "v0.2.0", notes: "", assetUrl: "https://x/y.dmg" },
    });
    downloadMock.mockRejectedValueOnce(new Error("下载失败"));
    downloadMock.mockResolvedValueOnce(undefined);
    render(<SettingsPanel onClose={vi.fn()} />);

    await userEvent.click(await screen.findByText("检查更新"));
    await userEvent.click(await screen.findByText("下载更新"));

    expect(await screen.findByText("下载失败")).toBeInTheDocument();
    expect(openPathMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText("重试"));
    expect(downloadMock).toHaveBeenCalledTimes(2);
  });

  it("点击关闭按钮触发 onClose 回调", async () => {
    const onClose = vi.fn();
    render(<SettingsPanel onClose={onClose} />);

    await userEvent.click(await screen.findByText("关闭"));

    expect(onClose).toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const getVersionMock = vi.fn();
const checkForUpdateMock = vi.fn();

vi.mock("@tauri-apps/api/app", () => ({ getVersion: getVersionMock }));
vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn().mockResolvedValue("/fake/appdata"),
  join: (...parts: string[]) => Promise.resolve(parts.join("/")),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openPath: vi.fn() }));
vi.mock("@tauri-apps/plugin-upload", () => ({ download: vi.fn() }));
vi.mock("../../lib/updater", () => ({ checkForUpdate: checkForUpdateMock }));
vi.mock("../../lib/fs", () => ({ pathExists: vi.fn(), removeFile: vi.fn() }));

const { useUpdateStore } = await import("../../stores/updateStore");
const { VersionSettings } = await import("./VersionSettings");

describe("VersionSettings", () => {
  beforeEach(() => {
    getVersionMock.mockReset();
    checkForUpdateMock.mockReset();
    useUpdateStore.setState({
      status: "idle",
      currentVersion: "",
      release: null,
      downloadProgress: 0,
      errorMessage: "",
    });
  });

  it("独立渲染时加载并展示当前版本", async () => {
    getVersionMock.mockResolvedValueOnce("0.2.0");

    render(<VersionSettings />);

    expect(await screen.findByText("v0.2.0")).toBeInTheDocument();
  });

  it("版本读取失败时提供读取重试，而不是误发起更新检查", async () => {
    getVersionMock.mockRejectedValueOnce(new Error("版本读取失败"));

    render(<VersionSettings />);

    expect(await screen.findByText("版本读取失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    expect(checkForUpdateMock).not.toHaveBeenCalled();
  });
});

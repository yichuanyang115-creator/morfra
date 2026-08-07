import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: fetchMock,
}));

const { checkForUpdate } = await import("./updater");

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("checkForUpdate", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("最新 Release 版本号高于当前版本时返回 hasUpdate=true 及 dmg 下载地址和说明", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        tag_name: "v0.2.0",
        body: "修复了若干问题",
        assets: [
          { name: "reqflow_0.2.0_aarch64.dmg", browser_download_url: "https://example.com/reqflow_0.2.0.dmg" },
        ],
      }),
    );

    const result = await checkForUpdate("0.1.0");

    expect(result).toEqual({
      hasUpdate: true,
      release: { version: "v0.2.0", notes: "修复了若干问题", assetUrl: "https://example.com/reqflow_0.2.0.dmg" },
    });
  });

  it("最新 Release 版本号等于当前版本时返回 hasUpdate=false，不下钻 asset", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { tag_name: "v0.1.0", body: "", assets: [] }));

    const result = await checkForUpdate("0.1.0");

    expect(result).toEqual({ hasUpdate: false });
  });

  it("最新 Release 版本号低于当前版本（本地跑的是未发布的开发版）时返回 hasUpdate=false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { tag_name: "v0.0.9", body: "", assets: [] }));

    const result = await checkForUpdate("0.1.0");

    expect(result).toEqual({ hasUpdate: false });
  });

  it("网络请求返回非 2xx 状态码时抛出错误，供上层展示内联错误提示", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, {}));

    await expect(checkForUpdate("0.1.0")).rejects.toThrow();
  });

  it("有新版本但 assets 里找不到 dmg 文件时抛出错误", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        tag_name: "v0.2.0",
        body: "",
        assets: [{ name: "reqflow_0.2.0.tar.gz", browser_download_url: "https://example.com/x.tar.gz" }],
      }),
    );

    await expect(checkForUpdate("0.1.0")).rejects.toThrow();
  });

  it("Release 同时有 Intel 和 Apple Silicon 包时只选择 aarch64 dmg", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        tag_name: "v0.2.0",
        body: "",
        assets: [
          { name: "reqflow_0.2.0_x86_64.dmg", browser_download_url: "https://example.com/intel.dmg" },
          { name: "reqflow_0.2.0_aarch64.dmg", browser_download_url: "https://example.com/arm.dmg" },
        ],
      }),
    );

    await expect(checkForUpdate("0.1.0")).resolves.toMatchObject({
      release: { assetUrl: "https://example.com/arm.dmg" },
    });
  });

  it("fetch 本身抛错（断网）时错误原样向上抛出", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network error"));

    await expect(checkForUpdate("0.1.0")).rejects.toThrow("network error");
  });
});

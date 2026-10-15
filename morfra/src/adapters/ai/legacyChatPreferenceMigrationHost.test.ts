import { beforeEach, describe, expect, it, vi } from "vitest";
import { findLegacyChatPreferenceMigration } from "./legacyChatPreferenceMigrationHost";

const { files, readTextFileMock } = vi.hoisted(() => ({ files: new Map<string, string>(), readTextFileMock: vi.fn(async (path: string) => files.get(path) ?? "") }));

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => files.has(path)),
  readTextFile: readTextFileMock,
}));
vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "/app-local-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

describe("legacyChatPreferenceMigrationHost", () => {
  beforeEach(() => { files.clear(); readTextFileMock.mockClear(); });

  it("只在新 AI 偏好不存在时从旧项目返回 open/width 候选", async () => {
    files.set("/app-local-data/projects/project-a/_chat.md", "---\nopen: true\nwidth: 388\nmessages: [{ content: 假消息 }]\n---\n");

    await expect(findLegacyChatPreferenceMigration("project-a")).resolves.toEqual({ open: true, width: 388 });
    expect(readTextFileMock).toHaveBeenCalledWith("/app-local-data/projects/project-a/_chat.md");
  });

  it("新偏好存在时不读取、不覆盖旧 _chat.md", async () => {
    files.set("/app-local-data/ai/preferences.json", "{\"version\":1}");
    files.set("/app-local-data/projects/project-a/_chat.md", "---\nopen: false\nwidth: 320\n---\n");

    await expect(findLegacyChatPreferenceMigration("project-a")).resolves.toBeNull();
    expect(readTextFileMock).not.toHaveBeenCalled();
  });
});

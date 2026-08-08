import { beforeEach, describe, expect, it, vi } from "vitest";

const { files, writeTextFileMock, removeMock } = vi.hoisted(() => ({
  files: new Map<string, string>(),
  writeTextFileMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => files.has(path)),
  readTextFile: vi.fn(async (path: string) => files.get(path) ?? ""),
  writeTextFile: writeTextFileMock,
  remove: removeMock,
}));

const { parseLegacyChatPreference, readLegacyChatPreference } = await import("./legacyChatMigration");

const LEGACY_PATH = "/app-local-data/projects/project-a/_chat.md";
const LEGACY_RAW = [
  "---",
  "open: true",
  "width: 388",
  "messages:",
  "  - id: fake-user",
  "    role: user",
  "    content: 旧问题",
  "  - id: fake-assistant",
  "    role: assistant",
  "    content: 这个功能还在开发中，暂时只能陪你聊聊。",
  "---",
  "",
].join("\n");

describe("旧 _chat.md 只读迁移", () => {
  beforeEach(() => {
    files.clear();
    writeTextFileMock.mockClear();
    removeMock.mockClear();
  });

  it("只提取 open/width，绝不返回旧假消息", () => {
    const before = LEGACY_RAW;
    const candidate = parseLegacyChatPreference(LEGACY_RAW);

    expect(candidate).toEqual({ open: true, width: 388 });
    expect(candidate).not.toHaveProperty("messages");
    expect(LEGACY_RAW).toBe(before);
  });

  it("读取旧文件后不覆盖、不删除且原始内容逐字节不变", async () => {
    files.set(LEGACY_PATH, LEGACY_RAW);

    await expect(readLegacyChatPreference(LEGACY_PATH)).resolves.toEqual({ open: true, width: 388 });

    expect(files.get(LEGACY_PATH)).toBe(LEGACY_RAW);
    expect(writeTextFileMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("损坏或没有有效偏好的旧文件返回 null，不尝试修复原文件", async () => {
    files.set(LEGACY_PATH, "---\nmessages: [broken\n---\n");

    await expect(readLegacyChatPreference(LEGACY_PATH)).resolves.toBeNull();
    expect(files.get(LEGACY_PATH)).toBe("---\nmessages: [broken\n---\n");
    expect(writeTextFileMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });
});

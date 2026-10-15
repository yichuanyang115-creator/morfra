import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "/app-local-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

const {
  aiConversationIndexPath,
  aiConversationPath,
  aiPreferencesPath,
  aiProvidersPath,
  aiTableDir,
} = await import("./paths");

describe("AI 持久化路径", () => {
  it("应用配置与会话严格落到独立 ai 目录", async () => {
    await expect(aiProvidersPath()).resolves.toBe("/app-local-data/ai/providers.json");
    await expect(aiPreferencesPath()).resolves.toBe("/app-local-data/ai/preferences.json");
    await expect(aiConversationIndexPath("table-a")).resolves.toBe("/app-local-data/ai/tables/table-a/conversations.json");
    await expect(aiConversationPath("table-a", "conversation-1")).resolves.toBe(
      "/app-local-data/ai/tables/table-a/conversations/conversation-1.md",
    );
  });

  it("拒绝可逃逸到其他目录的 tableId 和 conversationId", async () => {
    await expect(aiTableDir("../projects")).rejects.toThrow("tableId");
    await expect(aiConversationPath("table-a", "../../_chat")).rejects.toThrow("conversationId");
  });
});

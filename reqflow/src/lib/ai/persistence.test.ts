import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConversation, AIPanelPreference, AIProviderConfig } from "../../types/ai";
const fsMock = vi.hoisted(() => ({
  files: new Map<string, string>(),
  directories: new Set<string>(),
  writeCalls: [] as Array<{ path: string; content: string }>,
  renameCalls: [] as Array<{ from: string; to: string }>,
  failNextRename: false,
  failRenameTarget: null as string | null,
  blockedWrite: null as Promise<void> | null,
}));
function hasPath(path: string): boolean {
  if (fsMock.files.has(path) || fsMock.directories.has(path)) return true;
  const prefix = `${path}/`;
  return [...fsMock.files.keys(), ...fsMock.directories].some((candidate) => candidate.startsWith(prefix));
}
vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => hasPath(path)),
  mkdir: vi.fn(async (path: string) => { fsMock.directories.add(path); }),
  readTextFile: vi.fn(async (path: string) => {
    const value = fsMock.files.get(path);
    if (value === undefined) throw new Error("missing");
    return value;
  }),
  readDir: vi.fn(async (path: string) => {
    const prefix = `${path}/`;
    return [...fsMock.files.keys()]
      .filter((filePath) => filePath.startsWith(prefix) && !filePath.slice(prefix.length).includes("/"))
      .map((filePath) => ({ name: filePath.slice(prefix.length), isFile: true, isDirectory: false, isSymlink: false }));
  }),
  writeTextFile: vi.fn(async (path: string, content: string) => {
    fsMock.writeCalls.push({ path, content });
    if (fsMock.blockedWrite) await fsMock.blockedWrite;
    fsMock.files.set(path, content);
  }),
  rename: vi.fn(async (from: string, to: string) => {
    fsMock.renameCalls.push({ from, to });
    if (fsMock.failNextRename || fsMock.failRenameTarget === to) {
      fsMock.failNextRename = false;
      fsMock.failRenameTarget = null;
      throw new Error("rename failed");
    }
    const content = fsMock.files.get(from);
    if (content === undefined) throw new Error("missing source");
    fsMock.files.set(to, content);
    fsMock.files.delete(from);
  }),
  remove: vi.fn(async (path: string, options?: { recursive?: boolean }) => {
    if (options?.recursive) {
      const prefix = `${path}/`;
      for (const filePath of [...fsMock.files.keys()]) if (filePath === path || filePath.startsWith(prefix)) fsMock.files.delete(filePath);
      for (const dirPath of [...fsMock.directories]) if (dirPath === path || dirPath.startsWith(prefix)) fsMock.directories.delete(dirPath);
      return;
    }
    fsMock.files.delete(path);
  }),
}));
vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "/app-local-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));
const {
  clearAllAIConversationData,
  deleteAIConversation,
  deleteTableAIData,
  loadAIConversationIndex,
  loadAIConversations,
  loadAIPanelPreference,
  loadAIProviderConfigs,
  saveAIConversation,
  saveAIPanelPreference,
  saveAIProviderConfigs,
} = await import("./persistence");
const PREFERENCE: AIPanelPreference = {
  open: true,
  width: 360,
  defaultProviderConfigId: "provider-1",
  dataExfiltrationConfirmed: false,
  lastProviderConfigId: "provider-1",
  lastModelId: "model-1",
};
const PROVIDER: AIProviderConfig = {
  id: "provider-1",
  name: "兼容服务",
  baseUrl: "https://example.com/v1",
  defaultModelId: "model-1",
  cachedModelIds: ["model-1"],
  capabilityStatus: "unknown",
  createdAt: "2026-08-08T08:00:00.000Z",
  updatedAt: "2026-08-08T08:00:00.000Z",
};
function conversation(tableId: string, id: string, title = id): AIConversation {
  const createdAt = `2026-08-08T08:0${id.endsWith("2") ? "2" : "1"}:00.000Z`;
  return {
    id,
    tableId,
    mode: "table-analysis",
    title,
    providerConfigId: "provider-1",
    modelId: "model-1",
    messages: [
      {
        id: `${id}-message`,
        conversationId: id,
        role: "user",
        contentBlocks: [{ type: "markdown", markdown: `分析 ${tableId}` }],
        contextRef: { type: "fullTable" },
        providerConfigId: "provider-1",
        modelId: "model-1",
        status: "complete",
        createdAt,
      },
    ],
    createdAt,
    updatedAt: createdAt,
  };
}
function conversationPath(tableId: string, conversationId: string): string {
  return `/app-local-data/ai/tables/${tableId}/conversations/${conversationId}.md`;
}
describe("AI 本地持久化", () => {
  beforeEach(() => {
    fsMock.files.clear();
    fsMock.directories.clear();
    fsMock.writeCalls.length = 0;
    fsMock.renameCalls.length = 0;
    fsMock.failNextRename = false;
    fsMock.failRenameTarget = null;
    fsMock.blockedWrite = null;
  });
  it("所有保存先写临时文件再原子替换，替换失败时保留原目标", async () => {
    await saveAIPanelPreference(PREFERENCE);
    const target = "/app-local-data/ai/preferences.json";
    const original = fsMock.files.get(target);
    fsMock.failNextRename = true;
    await expect(saveAIPanelPreference({ ...PREFERENCE, width: 480 })).rejects.toThrow("rename failed");
    expect(fsMock.files.get(target)).toBe(original);
    expect(fsMock.writeCalls.every((call) => call.path.includes(".tmp-"))).toBe(true);
    expect(fsMock.renameCalls.every((call) => call.from.includes(".tmp-") || call.to.includes(".corrupt-"))).toBe(true);
    expect([...fsMock.files.keys()].some((path) => path.includes(".tmp-"))).toBe(false);
  });
  it("应用级配置会剥离额外密钥字段并可恢复", async () => {
    const unsafeSecret = ["placeholder", "only"].join("-");
    const unsafe = { ...PROVIDER, apiKey: unsafeSecret } as AIProviderConfig;
    await saveAIProviderConfigs([unsafe]);
    const raw = fsMock.files.get("/app-local-data/ai/providers.json") ?? "";
    expect(raw).not.toContain(unsafeSecret);
    expect(raw).not.toContain("apiKey");
    await expect(loadAIProviderConfigs()).resolves.toMatchObject({ value: [PROVIDER], issues: [] });
  });
  it("表 A 与表 B 的会话写入和读取严格隔离", async () => {
    await saveAIConversation(conversation("table-a", "conversation-a"));
    await saveAIConversation(conversation("table-b", "conversation-b"));
    const tableA = await loadAIConversations("table-a");
    const tableB = await loadAIConversations("table-b");
    expect(tableA.value.map((item) => item.id)).toEqual(["conversation-a"]);
    expect(tableB.value.map((item) => item.id)).toEqual(["conversation-b"]);
    expect(tableA.value[0].messages[0].contentBlocks).toEqual([{ type: "markdown", markdown: "分析 table-a" }]);
    expect(tableB.value[0].messages[0].contentBlocks).toEqual([{ type: "markdown", markdown: "分析 table-b" }]);
  });
  it("同表并发保存会线性化并保留全部会话索引", async () => {
    await Promise.all([
      saveAIConversation(conversation("table-a", "conversation-a1")),
      saveAIConversation(conversation("table-a", "conversation-a2")),
    ]);
    expect((await loadAIConversations("table-a")).value.map((item) => item.id)).toEqual([
      "conversation-a2",
      "conversation-a1",
    ]);
    expect((await loadAIConversationIndex("table-a")).value.conversations.map((item) => item.id)).toEqual([
      "conversation-a2",
      "conversation-a1",
    ]);
  });
  it("会话文件已提交但索引替换中断时，下次加载会扫描事实文件并修复索引", async () => {
    await saveAIConversation(conversation("table-a", "conversation-a1"));
    fsMock.failRenameTarget = "/app-local-data/ai/tables/table-a/conversations.json";

    await expect(saveAIConversation(conversation("table-a", "conversation-a2"))).rejects.toThrow("rename failed");
    expect(fsMock.files.has(conversationPath("table-a", "conversation-a2"))).toBe(true);

    const recovered = await loadAIConversations("table-a");
    expect(recovered.value.map((item) => item.id)).toEqual(["conversation-a2", "conversation-a1"]);
    expect((await loadAIConversationIndex("table-a")).value.conversations.map((item) => item.id)).toEqual([
      "conversation-a2",
      "conversation-a1",
    ]);
  });

  it("损坏表 A 单会话时只隔离该文件，同表其他会话与表 B 完全不变", async () => {
    await saveAIConversation(conversation("table-a", "conversation-a1"));
    await saveAIConversation(conversation("table-a", "conversation-a2"));
    await saveAIConversation(conversation("table-b", "conversation-b"));
    const brokenPath = conversationPath("table-a", "conversation-a1");
    const tableBBefore = fsMock.files.get(conversationPath("table-b", "conversation-b"));
    fsMock.files.set(brokenPath, "---\nversion: 99\nconversation: broken\n---\n");

    const tableA = await loadAIConversations("table-a");
    const tableB = await loadAIConversations("table-b");

    expect(tableA.value.map((item) => item.id)).toEqual(["conversation-a2"]);
    expect(tableA.issues).toHaveLength(1);
    expect(tableA.issues[0]).toMatchObject({ path: brokenPath, kind: "corrupt" });
    expect(fsMock.files.has(brokenPath)).toBe(false);
    expect([...fsMock.files.keys()].some((path) => path.startsWith(`${brokenPath}.corrupt-`))).toBe(true);
    expect(tableB.value.map((item) => item.id)).toEqual(["conversation-b"]);
    expect(fsMock.files.get(conversationPath("table-b", "conversation-b"))).toBe(tableBBefore);
  });

  it("删除一条会话后更新索引，保留同表其他会话和另一张表", async () => {
    await saveAIConversation(conversation("table-a", "conversation-a1"));
    await saveAIConversation(conversation("table-a", "conversation-a2"));
    await saveAIConversation(conversation("table-b", "conversation-b"));

    await deleteAIConversation("table-a", "conversation-a2");

    expect(fsMock.files.has(conversationPath("table-a", "conversation-a2"))).toBe(false);
    expect((await loadAIConversations("table-a")).value.map((item) => item.id)).toEqual(["conversation-a1"]);
    expect((await loadAIConversationIndex("table-a")).value.currentConversationId).toBe("conversation-a1");
    expect((await loadAIConversations("table-b")).value.map((item) => item.id)).toEqual(["conversation-b"]);
  });

  it("删除表 AI 数据只删除目标表", async () => {
    await saveAIConversation(conversation("table-a", "conversation-a"));
    await saveAIConversation(conversation("table-b", "conversation-b"));

    await deleteTableAIData("table-a");

    expect((await loadAIConversations("table-a")).value).toEqual([]);
    expect((await loadAIConversations("table-b")).value.map((item) => item.id)).toEqual(["conversation-b"]);
  });

  it("删表会等待已经开始的保存，返回后目标表数据不会复活", async () => {
    let releaseWrite: (() => void) | undefined;
    fsMock.blockedWrite = new Promise<void>((resolve) => { releaseWrite = resolve; });
    const savePromise = saveAIConversation(conversation("table-a", "conversation-a"));
    await vi.waitFor(() => expect(fsMock.writeCalls.length).toBeGreaterThan(0));

    let deletionFinished = false;
    const deletePromise = deleteTableAIData("table-a").then(() => { deletionFinished = true; });
    await Promise.resolve();
    expect(deletionFinished).toBe(false);

    releaseWrite?.();
    fsMock.blockedWrite = null;
    await Promise.all([savePromise, deletePromise]);
    expect((await loadAIConversations("table-a")).value).toEqual([]);
  });

  it("清空历史会等待已经开始的保存，返回后任何表都不会复活", async () => {
    let releaseWrite: (() => void) | undefined;
    fsMock.blockedWrite = new Promise<void>((resolve) => { releaseWrite = resolve; });
    const savePromise = saveAIConversation(conversation("table-a", "conversation-a"));
    await vi.waitFor(() => expect(fsMock.writeCalls.length).toBeGreaterThan(0));

    let clearFinished = false;
    const clearPromise = clearAllAIConversationData().then(() => { clearFinished = true; });
    await Promise.resolve();
    expect(clearFinished).toBe(false);

    releaseWrite?.();
    fsMock.blockedWrite = null;
    await Promise.all([savePromise, clearPromise]);
    expect((await loadAIConversations("table-a")).value).toEqual([]);
  });

  it("清空全部历史不删除服务配置、面板偏好、表数据或旧 _chat.md", async () => {
    await saveAIProviderConfigs([PROVIDER]);
    await saveAIPanelPreference(PREFERENCE);
    await saveAIConversation(conversation("table-a", "conversation-a"));
    await saveAIConversation(conversation("table-b", "conversation-b"));
    const legacyPath = "/app-local-data/projects/project-a/_chat.md";
    const tableDataPath = "/app-local-data/projects/project-a/record.md";
    fsMock.files.set(legacyPath, "legacy-chat-exact-content");
    fsMock.files.set(tableDataPath, "table-data");

    await clearAllAIConversationData();

    expect((await loadAIConversations("table-a")).value).toEqual([]);
    expect((await loadAIConversations("table-b")).value).toEqual([]);
    expect((await loadAIProviderConfigs()).value).toEqual([PROVIDER]);
    expect((await loadAIPanelPreference({ ...PREFERENCE, open: false })).value).toEqual(PREFERENCE);
    expect(fsMock.files.get(legacyPath)).toBe("legacy-chat-exact-content");
    expect(fsMock.files.get(tableDataPath)).toBe("table-data");
  });

  it("损坏应用级偏好时隔离文件并返回调用方提供的安全回退", async () => {
    const path = "/app-local-data/ai/preferences.json";
    fsMock.files.set(path, "{broken-json");
    const fallback = { ...PREFERENCE, open: false, width: 320 };

    const result = await loadAIPanelPreference(fallback);

    expect(result.value).toEqual(fallback);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].kind).toBe("corrupt");
    expect(fsMock.files.has(path)).toBe(false);
    expect([...fsMock.files.keys()].some((candidate) => candidate.startsWith(`${path}.corrupt-`))).toBe(true);
  });
});

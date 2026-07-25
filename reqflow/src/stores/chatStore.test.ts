import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const { useChatStore } = await import("./chatStore");

const PROJECT_A = "proj-a";
const PROJECT_B = "proj-b";

function chatPath(projectId: string) {
  return `/app-local-data/projects/${projectId}/_chat.md`;
}

describe("chatStore（REQ-024 v2.7：顶栏手动开关 + 按项目落盘）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    files.clear();
    useChatStore.setState({ open: false, messages: [], thinking: false, loadedProjectId: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loadForProject 首次进入某项目（还没有 _chat.md 文件）时，恢复默认关闭态和空消息", async () => {
    await useChatStore.getState().loadForProject(PROJECT_A);

    const state = useChatStore.getState();
    expect(state.open).toBe(false);
    expect(state.messages).toHaveLength(0);
    expect(state.loadedProjectId).toBe(PROJECT_A);
  });

  it("toggleOpen 翻转开关状态并落盘，重新 loadForProject 同一项目能读回该状态", async () => {
    await useChatStore.getState().loadForProject(PROJECT_A);
    await useChatStore.getState().toggleOpen();

    expect(useChatStore.getState().open).toBe(true);
    expect(files.get(chatPath(PROJECT_A))).toContain("open: true");

    // 模拟重开应用：清空内存态，重新从磁盘加载
    useChatStore.setState({ open: false, messages: [], thinking: false, loadedProjectId: null });
    await useChatStore.getState().loadForProject(PROJECT_A);

    expect(useChatStore.getState().open).toBe(true);
  });

  it("sendMessage 立即落一条 user 消息、进入思考态并同步落盘；思考延迟结束后追加固定回复", async () => {
    await useChatStore.getState().loadForProject(PROJECT_A);

    useChatStore.getState().sendMessage("你好");
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().thinking).toBe(true);
    // sendMessage 内部落盘是 fire-and-forget 的 async 调用链（persist → chatStatePath →
    // projectDir → projectsRootDir → appLocalDataDir/join），要多等几拍微任务才能写完
    await vi.waitFor(() => expect(files.get(chatPath(PROJECT_A))).toContain("你好"));

    await vi.runAllTimersAsync();

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1].role).toBe("assistant");
    expect(state.thinking).toBe(false);
    expect(files.get(chatPath(PROJECT_A))).toContain(state.messages[1].content);
  });

  it("空消息不发送，不落盘", async () => {
    await useChatStore.getState().loadForProject(PROJECT_A);
    const before = files.get(chatPath(PROJECT_A));

    useChatStore.getState().sendMessage("   ");

    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(files.get(chatPath(PROJECT_A))).toBe(before);
  });

  it("clearChat 清空消息并落盘，重新加载后消息确实消失（不是只清了内存）", async () => {
    await useChatStore.getState().loadForProject(PROJECT_A);
    useChatStore.getState().sendMessage("会被清空的消息");
    await vi.runAllTimersAsync();
    expect(useChatStore.getState().messages.length).toBeGreaterThan(0);

    await useChatStore.getState().clearChat();
    expect(useChatStore.getState().messages).toHaveLength(0);

    useChatStore.setState({ open: false, messages: [{ id: "stale", role: "user", content: "残留" }], loadedProjectId: null });
    await useChatStore.getState().loadForProject(PROJECT_A);

    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it("切换项目后开关状态和对话内容各自独立，互不影响", async () => {
    await useChatStore.getState().loadForProject(PROJECT_A);
    await useChatStore.getState().toggleOpen();
    useChatStore.getState().sendMessage("项目 A 的消息");
    await vi.runAllTimersAsync();

    await useChatStore.getState().loadForProject(PROJECT_B);
    expect(useChatStore.getState().open).toBe(false);
    expect(useChatStore.getState().messages).toHaveLength(0);

    await useChatStore.getState().loadForProject(PROJECT_A);
    expect(useChatStore.getState().open).toBe(true);
    expect(useChatStore.getState().messages.length).toBeGreaterThan(0);
  });

  it("发送后思考延迟期间切换了项目，思考延迟结束时不会把回复写回旧项目状态（避免串项目）", async () => {
    await useChatStore.getState().loadForProject(PROJECT_A);
    useChatStore.getState().sendMessage("发送后马上切项目");

    await useChatStore.getState().loadForProject(PROJECT_B);
    await vi.runAllTimersAsync();

    // 此刻 store 展示的是项目 B 的状态，不应该被项目 A 的延迟回调污染
    expect(useChatStore.getState().loadedProjectId).toBe(PROJECT_B);
    expect(useChatStore.getState().messages).toHaveLength(0);
  });
});

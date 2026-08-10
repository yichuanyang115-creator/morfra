import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AIConversation, AIMessage } from "../../types/ai";
import type { TableSnapshot } from "../../lib/ai/tableDataAdapter";
import { useAIConversationStore } from "../../stores/aiConversationStore";
import { useAIProviderStore } from "../../stores/aiProviderStore";
import { ChatPanel } from "./ChatPanel";

vi.mock("@tauri-apps/plugin-fs", () => ({ exists: vi.fn(async () => false), readTextFile: vi.fn(async () => ""), writeTextFile: vi.fn(async () => undefined), mkdir: vi.fn(async () => undefined) }));
vi.mock("@tauri-apps/api/path", () => ({ appLocalDataDir: vi.fn(async () => "/app-local-data"), join: vi.fn(async (...parts: string[]) => parts.join("/")) }));

const snapshot: TableSnapshot = { tableId: "table-1", name: "需求表", schemaVersion: "1", primaryTitleFieldId: "title", fields: [{ id: "title", name: "标题", type: "text" }, { id: "stage", name: "阶段", type: "singleSelect", options: [{ id: "todo", label: "待办" }] }], records: [{ id: "record-1", values: { title: "接入 AI", stage: "todo" } }], capturedAt: "2026-08-10T00:00:00.000Z" };
const provider = { id: "provider-1", name: "本地兼容服务", baseUrl: "https://example.test/v1", defaultModelId: "model-a", cachedModelIds: ["model-a"], capabilityStatus: "available" as const, createdAt: "2026-08-10", updatedAt: "2026-08-10" };
const adapter = { getActiveTable: () => ({ tableId: "table-1", name: "需求表" }), getTableSnapshot: vi.fn(async () => snapshot), getSelectedRecordIds: () => ["record-1"], subscribe: vi.fn(() => () => undefined) };
const hostActions = { openRecord: vi.fn() };

function message(role: "user" | "assistant", content: string, status: AIMessage["status"] = "complete", conversationId = "conversation-1"): AIMessage {
  return { id: `${role}-${content}`, conversationId, role, contentBlocks: [{ type: "markdown", markdown: content }], contextRef: { type: "fullTable" }, providerConfigId: provider.id, modelId: provider.defaultModelId, status, createdAt: "2026-08-10" };
}

const conversation: AIConversation = { id: "conversation-1", tableId: "table-1", mode: "table-analysis", title: "表格分析", providerConfigId: provider.id, modelId: provider.defaultModelId, messages: [], createdAt: "2026-08-10", updatedAt: "2026-08-10" };

function resetStores(): void {
  useAIProviderStore.setState({ configs: [provider], secretStatus: { [provider.id]: true }, defaultProviderConfigId: provider.id, lastProviderConfigId: provider.id, lastModelId: provider.defaultModelId, modelIds: { [provider.id]: [provider.defaultModelId] }, dataExfiltrationConfirmed: true, loaded: true, panelOpen: true, panelWidth: 360 });
  useAIConversationStore.setState({ activeTableId: null, conversationsByTable: {}, currentConversationIdByTable: {}, loadedTables: {}, loadingTables: {}, activeRequests: {}, persistenceError: null });
  hostActions.openRecord.mockReset();
  adapter.getTableSnapshot.mockClear();
}

function renderPanel() {
  return render(<ChatPanel width={360} tableContext={{ table: { tableId: "table-1", name: "需求表" }, adapter, snapshot }} hostActions={hostActions} />);
}

describe("ChatPanel Phase 6 右侧 AI 面板", () => {
  beforeEach(resetStores);
  afterEach(() => vi.restoreAllMocks());

  it("宽度为空时不卸载请求宿主内容，只返回空渲染", () => {
    const { container } = render(<ChatPanel width={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("具备顶部、上下文、消息和输入四区，并默认显示场景空白页", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByTestId("chat-context-bar")).toBeInTheDocument());
    expect(screen.getByTestId("chat-header")).toBeInTheDocument();
    expect(screen.getByRole("log", { name: "AI 对话消息" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "AI 输入" })).toBeInTheDocument();
    expect(screen.getByText("总结这张表")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "选择模型" })).toBeInTheDocument();
  });

  it("首次配置引导不把凭据或运行细节放进正常面板", async () => {
    useAIProviderStore.setState({ configs: [], secretStatus: {}, defaultProviderConfigId: null, lastProviderConfigId: null, lastModelId: null });
    renderPanel();
    await waitFor(() => expect(screen.getByText("配置 AI 服务后开始")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "前往 AI 服务设置" })).toBeInTheDocument();
    expect(screen.queryByText(/API Key|Base URL|Token|耗时|费用/u)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "输入问题" })).not.toBeInTheDocument();
  });

  it("已选范围快捷问题会把范围限定到当前消息", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, requestId: "request-selected" }));
    const createConversation = vi.fn(async () => conversation);
    const originalSend = useAIConversationStore.getState().sendMessage;
    const originalCreate = useAIConversationStore.getState().createConversation;
    useAIConversationStore.setState({ sendMessage, createConversation, loadedTables: { "table-1": true } });
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "总结已选记录" })).toBeInTheDocument());
    await userClick(screen.getByRole("button", { name: "总结已选记录" }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ question: "总结已选记录", selectionReferenced: true, selectedRecordIds: ["record-1"] })));
    useAIConversationStore.setState({ sendMessage: originalSend, createConversation: originalCreate });
  });

  it("支持已选范围、Enter 发送和 Shift+Enter 换行边界", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, requestId: "request-1" }));
    const originalSend = useAIConversationStore.getState().sendMessage;
    useAIConversationStore.setState({ sendMessage });
    useAIConversationStore.setState({ conversationsByTable: { "table-1": [conversation] }, currentConversationIdByTable: { "table-1": conversation.id }, loadedTables: { "table-1": true } });
    renderPanel();
    await waitFor(() => expect(screen.getByText("表格分析")).toBeInTheDocument());
    const quote = screen.getByRole("button", { name: "引用已选 1 条" });
    await userClick(quote);
    expect(screen.getByRole("button", { name: "已引用所选" })).toHaveAttribute("aria-pressed", "true");
    const input = screen.getByRole("textbox", { name: "输入问题" });
    fireEvent.change(input, { target: { value: "统计一下" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(sendMessage).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ selectionReferenced: true, selectedRecordIds: ["record-1"], question: "统计一下" })));
    useAIConversationStore.setState({ sendMessage: originalSend });
  });

  it("回答结构化引用只通过 HostActions 打开记录，点击不卸载面板", async () => {
    const answer: AIMessage = { ...message("assistant", "安全说明"), id: "assistant-1", contentBlocks: [{ type: "markdown", markdown: "## 结论\n\n|字段|值|\n|---|---|\n|阶段|待办|\n\n<script>alert(1)</script>" }, { type: "metrics", items: [{ label: "记录数", value: 1 }] }, { type: "recordRefs", records: [{ recordId: "record-1", title: "接入 AI" }] }] };
    useAIConversationStore.setState({ conversationsByTable: { "table-1": [{ ...conversation, messages: [answer] }] }, currentConversationIdByTable: { "table-1": conversation.id }, loadedTables: { "table-1": true } });
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "接入 AI" })).toBeInTheDocument());
    await userClick(screen.getByRole("button", { name: "接入 AI" }));
    expect(hostActions.openRecord).toHaveBeenCalledWith({ tableId: "table-1", recordId: "record-1" });
    expect(screen.getByRole("log", { name: "AI 对话消息" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("结论")).toBeInTheDocument();
    expect(screen.queryByText("alert(1)")).not.toBeInTheDocument();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => undefined) } });
    await userClick(screen.getByRole("button", { name: "复制" }));
    expect(screen.getByRole("button", { name: "已复制" })).toBeInTheDocument();
    expect(screen.queryByText(/Token|耗时|费用|Base URL|API Key/u)).not.toBeInTheDocument();
  });

  it("生成中显示停止入口并把停止动作交给会话编排", async () => {
    const stopConversation = vi.fn(async () => ({ ok: true, requestId: "request-stop" }));
    const originalStop = useAIConversationStore.getState().stopConversation;
    useAIConversationStore.setState({ conversationsByTable: { "table-1": [{ ...conversation, messages: [message("assistant", "正在整理", "streaming")] }] }, currentConversationIdByTable: { "table-1": conversation.id }, loadedTables: { "table-1": true }, activeRequests: { [conversation.id]: { requestId: "request-stop", assistantMessageId: "assistant-正在整理", acceptDeltas: true, stop: vi.fn(async () => undefined) } }, stopConversation });
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "停止生成" })).toBeInTheDocument());
    await userClick(screen.getByRole("button", { name: "停止生成" }));
    expect(stopConversation).toHaveBeenCalledWith(conversation.id);
    useAIConversationStore.setState({ stopConversation: originalStop });
  });

  it("历史支持切换、重命名、删除和错误消息重试入口", async () => {
    const other = { ...conversation, id: "conversation-2", title: "旧会话", mode: "general" as const };
    const failed = { ...conversation, id: "conversation-failed", messages: [message("user", "上一个问题", "complete", "conversation-failed"), message("assistant", "失败", "failed", "conversation-failed")] };
    useAIConversationStore.setState({ conversationsByTable: { "table-1": [conversation, other, failed] }, currentConversationIdByTable: { "table-1": failed.id }, loadedTables: { "table-1": true } });
    const renameConversation = vi.fn(async () => ({ ok: true }));
    const deleteConversation = vi.fn(async () => ({ ok: true }));
    const retryMessage = vi.fn(async () => ({ ok: true, requestId: "request-retry" }));
    const originalRename = useAIConversationStore.getState().renameConversation;
    const originalDelete = useAIConversationStore.getState().deleteConversation;
    const originalRetry = useAIConversationStore.getState().retryMessage;
    useAIConversationStore.setState({ renameConversation, deleteConversation, retryMessage });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "查看历史" })).toBeInTheDocument());
    await userClick(screen.getByRole("button", { name: "查看历史" }));
    expect(screen.getByText("旧会话")).toBeInTheDocument();
    await userClick(screen.getByRole("button", { name: "重命名旧会话" }));
    fireEvent.change(screen.getByRole("textbox", { name: "会话标题" }), { target: { value: "已改名" } });
    await userClick(screen.getByRole("button", { name: "保存" }));
    expect(renameConversation).toHaveBeenCalledWith("table-1", "conversation-2", "已改名");
    await userClick(screen.getByRole("button", { name: "删除旧会话" }));
    expect(deleteConversation).toHaveBeenCalledWith("table-1", "conversation-2");
    await userClick(screen.getByRole("button", { name: "返回对话" }));
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    await userClick(screen.getByRole("button", { name: "重试" }));
    expect(retryMessage).toHaveBeenCalledWith(expect.objectContaining({ tableId: "table-1", conversationId: "conversation-failed" }));
    useAIConversationStore.setState({ renameConversation: originalRename, deleteConversation: originalDelete, retryMessage: originalRetry });
  });
});

async function userClick(element: HTMLElement): Promise<void> {
  await act(async () => { fireEvent.click(element); });
}

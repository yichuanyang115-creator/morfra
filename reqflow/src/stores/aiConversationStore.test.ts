import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEvaluationTableAdapter } from "../fixtures/aiEvaluationTables";
import type { AIChatHandle, AIChatRequest } from "../lib/ai/providerClient";
import type { AIConversationPersistence } from "./aiConversationStore";
import { createAIConversationStore } from "./aiConversationStore";

function memoryPersistence() {
  const conversations = new Map<string, Map<string, import("../types/ai").AIConversation>>();
  const current = new Map<string, string | null>();
  const persistence: AIConversationPersistence = {
    loadAIConversationIndex: async (tableId) => ({ value: { version: 1, tableId, currentConversationId: current.get(tableId) ?? null, conversations: [...(conversations.get(tableId)?.values() ?? [])].map(({ messages: _messages, ...item }) => item) }, issues: [] }),
    loadAIConversations: async (tableId) => ({ value: [...(conversations.get(tableId)?.values() ?? [])].map((item) => structuredClone(item)), issues: [] }),
    saveAIConversation: async (conversation, makeCurrent = false) => {
      const table = conversations.get(conversation.tableId) ?? new Map();
      table.set(conversation.id, structuredClone(conversation));
      conversations.set(conversation.tableId, table);
      if (makeCurrent) current.set(conversation.tableId, conversation.id);
    },
    deleteAIConversation: async (tableId, conversationId) => {
      conversations.get(tableId)?.delete(conversationId);
      if (current.get(tableId) === conversationId) current.set(tableId, [...(conversations.get(tableId)?.keys() ?? [])][0] ?? null);
    },
    clearAllAIConversationData: async () => { conversations.clear(); current.clear(); },
  };
  return { persistence, conversations };
}

function readyTransport(contents: Array<string | Error>) {
  const calls: AIChatRequest[] = [];
  return {
    calls,
    transport: {
      start: vi.fn(async (request: AIChatRequest, _onDelta?: (content: string) => void): Promise<AIChatHandle> => {
        calls.push(request);
        const next = contents.shift() ?? "回答";
        return {
          requestId: request.requestId ?? "request",
          completion: next instanceof Error
            ? Promise.reject(next)
            : Promise.resolve({ requestId: request.requestId ?? "request", content: next, streamed: true, status: "complete" as const }),
          cancel: async () => undefined,
        };
      }),
    },
  };
}

function runtime(adapter: ReturnType<typeof createEvaluationTableAdapter>["adapter"], transport: { start: AIChatTransport["start"] }, mode: "general" | "table-analysis" = "general") {
  return {
    adapter,
    providerConfig: { id: "provider-current", baseUrl: "https://example.test/v1", defaultModelId: mode === "general" ? "model-general" : "model-analysis" },
    dataExfiltrationConfirmed: true,
    transport,
  };
}

type AIChatTransport = import("../lib/ai/chatOrchestrator").AIChatTransport;

describe("Phase 5 aiConversationStore", () => {
  let clock = 0;
  beforeEach(() => { clock = 0; });

  it("并发切表加载时只允许最后一次目标表提交，旧表迟到结果不能抢回 activeTableId", async () => {
    const base = memoryPersistence();
    let releaseA: (() => void) | undefined;
    const waitForA = new Promise<void>((resolve) => { releaseA = resolve; });
    const persistence: AIConversationPersistence = {
      ...base.persistence,
      loadAIConversationIndex: async (tableId) => {
        if (tableId === "table-delivery") await waitForA;
        return base.persistence.loadAIConversationIndex(tableId);
      },
    };
    const store = createAIConversationStore({ persistence });
    const loadA = store.getState().loadTable("table-delivery");
    const loadB = store.getState().loadTable("table-budget");
    await loadB;
    expect(store.getState().activeTableId).toBe("table-budget");
    releaseA?.();
    await loadA;
    expect(store.getState().activeTableId).toBe("table-budget");
    expect(store.getState().conversationsByTable["table-budget"]).toEqual([]);
  });

  it("按表加载、切换并保持同表双模式与多会话，空新会话不继承消息", async () => {
    const { persistence } = memoryPersistence();
    const store = createAIConversationStore({ persistence, now: () => `2026-08-09T00:00:${String(clock++).padStart(2, "0")}.000Z`, createId: () => `id-${clock++}` });
    await store.getState().loadTable("table-delivery");
    const analysis = await store.getState().createConversation({ tableId: "table-delivery", mode: "table-analysis", providerConfigId: "provider-old", modelId: "model-old" });
    const general = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    const empty = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    expect(empty.messages).toEqual([]);
    expect(store.getState().conversationsByTable["table-delivery"]?.map((item) => item.mode)).toEqual(["general", "general", "table-analysis"]);

    await store.getState().loadTable("table-budget");
    expect(store.getState().getCurrentConversation()?.tableId ?? null).toBeNull();
    expect(store.getState().conversationsByTable["table-budget"]).toEqual([]);
    await store.getState().switchTable("table-delivery");
    expect(store.getState().conversationsByTable["table-delivery"]?.every((item) => item.tableId === "table-delivery")).toBe(true);
    expect(store.getState().getCurrentConversation()?.id).toBe(empty.id);
    expect(analysis.mode).toBe("table-analysis");
    expect(general.mode).toBe("general");
  });

  it("自动标题成功时更新，标题生成失败不影响主回答并回退到首条问题", async () => {
    const { persistence } = memoryPersistence();
    const store = createAIConversationStore({ persistence, createId: (() => { let id = 0; return () => `id-${id++}`; })() });
    const controls = createEvaluationTableAdapter();
    await store.getState().loadTable("table-delivery");
    const conversation = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    const fake = readyTransport(["主回答"]);
    const result = await store.getState().sendMessage({ tableId: "table-delivery", conversationId: conversation.id, question: "你好", runtime: { ...runtime(controls.adapter, fake.transport), generateTitle: async () => "当前表总结" } });
    expect(result.ok).toBe(true);
    expect(store.getState().getCurrentConversation()?.title).toBe("当前表总结");

    const failing = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    const second = readyTransport(["仍然完成"]);
    const secondResult = await store.getState().sendMessage({ tableId: "table-delivery", conversationId: failing.id, question: "你好，标题生成失败也要保留主回答", runtime: { ...runtime(controls.adapter, second.transport), generateTitle: async () => { throw new Error("title failed"); } } });
    expect(secondResult.ok).toBe(true);
    expect(store.getState().getCurrentConversation("table-delivery")?.title).toBe("你好，标题生成失败也要保留主回答");
    expect(store.getState().getCurrentConversation("table-delivery")?.messages.some((message) => messageText(message) === "仍然完成")).toBe(true);
  });

  it("停止后不再启动自动标题请求", async () => {
    const { persistence } = memoryPersistence();
    const store = createAIConversationStore({ persistence, createId: (() => { let id = 0; return () => `id-${id++}`; })() });
    const controls = createEvaluationTableAdapter();
    await store.getState().loadTable("table-delivery");
    const conversation = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    const generateTitle = vi.fn(async () => "不应生成");
    const transport = {
      start: vi.fn(async (request: AIChatRequest): Promise<AIChatHandle> => ({
        requestId: request.requestId ?? "stopped",
        completion: Promise.resolve({ requestId: request.requestId ?? "stopped", content: "", streamed: true, status: "stopped" as const }),
        cancel: async () => undefined,
      })),
    };

    const result = await store.getState().sendMessage({ tableId: "table-delivery", conversationId: conversation.id, question: "你好", runtime: { ...runtime(controls.adapter, transport), generateTitle } });

    expect(result.ok).toBe(false);
    expect(generateTitle).not.toHaveBeenCalled();
    expect(store.getState().getCurrentConversation()?.title).toBe("通用对话");
  });

  it("Provider 失败后不再启动自动标题请求", async () => {
    const { persistence } = memoryPersistence();
    const store = createAIConversationStore({ persistence, createId: (() => { let id = 0; return () => `id-${id++}`; })() });
    const controls = createEvaluationTableAdapter();
    await store.getState().loadTable("table-delivery");
    const conversation = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    const generateTitle = vi.fn(async () => "不应生成");
    const failed = readyTransport([new Error("provider failed")]);

    const result = await store.getState().sendMessage({ tableId: "table-delivery", conversationId: conversation.id, question: "你好", runtime: { ...runtime(controls.adapter, failed.transport), generateTitle } });

    expect(result.ok).toBe(false);
    expect(generateTitle).not.toHaveBeenCalled();
    expect(store.getState().getCurrentConversation()?.title).toBe("通用对话");
  });

  it("重命名、最近使用排序和删除只影响目标会话，历史保留旧 provider 引用", async () => {
    const { persistence } = memoryPersistence();
    const store = createAIConversationStore({ persistence, now: () => `2026-08-09T00:00:${String(clock++).padStart(2, "0")}.000Z`, createId: () => `id-${clock++}` });
    await store.getState().loadTable("table-delivery");
    const first = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "deleted-provider", modelId: "deleted-model" });
    const second = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-2", modelId: "model-2" });
    expect((await store.getState().renameConversation("table-delivery", first.id, " 新标题 ")).ok).toBe(true);
    expect((await store.getState().selectConversation("table-delivery", first.id)).ok).toBe(true);
    expect(store.getState().conversationsByTable["table-delivery"]?.[0]?.id).toBe(first.id);
    expect((await store.getState().deleteConversation("table-delivery", second.id)).ok).toBe(true);
    expect(store.getState().conversationsByTable["table-delivery"]?.map((item) => item.id)).toEqual([first.id]);
    expect(store.getState().getCurrentConversation()?.providerConfigId).toBe("deleted-provider");
    expect((await store.getState().setConversationModel("table-delivery", first.id, "provider-new", "model-new")).ok).toBe(true);
    expect(store.getState().getCurrentConversation()?.providerConfigId).toBe("provider-new");
    expect(store.getState().getCurrentConversation()?.messages.every((message) => message.providerConfigId === "deleted-provider")).toBe(true);
  });

  it("重新加载时把中断的 streaming 消息恢复为 stopped，其他表会话仍独立", async () => {
    const { persistence, conversations } = memoryPersistence();
    const store = createAIConversationStore({ persistence, createId: (() => { let id = 0; return () => `id-${id++}`; })() });
    await store.getState().loadTable("table-delivery");
    const conversation = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    const controls = createEvaluationTableAdapter();
    const fake = readyTransport(["完成"]);
    await store.getState().sendMessage({ tableId: "table-delivery", conversationId: conversation.id, question: "你好", runtime: runtime(controls.adapter, fake.transport) });
    const persisted = conversations.get("table-delivery")?.get(conversation.id);
    if (!persisted) throw new Error("测试会话没有落盘");
    const streaming = { ...persisted, messages: persisted.messages.map((message) => message.role === "assistant" ? { ...message, status: "streaming" as const } : message) };
    conversations.get("table-delivery")?.set(conversation.id, streaming);
    const restarted = createAIConversationStore({ persistence });
    await restarted.getState().loadTable("table-delivery");
    expect(restarted.getState().getCurrentConversation()?.messages.find((message) => message.role === "assistant")?.status).toBe("stopped");
    await restarted.getState().loadTable("table-budget");
    expect(restarted.getState().conversationsByTable["table-budget"]).toEqual([]);
  });

  it("重试不重复用户消息，停止后丢弃迟到片段并保留已生成内容", async () => {
    const { persistence } = memoryPersistence();
    const store = createAIConversationStore({ persistence, createId: (() => { let id = 0; return () => `id-${id++}`; })() });
    const controls = createEvaluationTableAdapter();
    await store.getState().loadTable("table-delivery");
    const failedConversation = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    const failedTransport = readyTransport([new Error("network")]);
    await store.getState().sendMessage({ tableId: "table-delivery", conversationId: failedConversation.id, question: "你好，请重试", runtime: runtime(controls.adapter, failedTransport.transport) });
    const failedAssistant = store.getState().getCurrentConversation()?.messages.find((message) => message.status === "failed");
    expect(failedAssistant).toBeDefined();
    const successTransport = readyTransport(["重试成功"]);
    expect((await store.getState().retryMessage({ tableId: "table-delivery", conversationId: failedConversation.id, assistantMessageId: failedAssistant?.id ?? "", runtime: runtime(controls.adapter, successTransport.transport) })).ok).toBe(true);
    const retried = store.getState().getCurrentConversation();
    expect(retried?.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(retried?.messages.filter((message) => message.role === "assistant")).toHaveLength(2);

    const stoppedConversation = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    let resolveCompletion: ((value: { requestId: string; content: string; streamed: boolean; status: "stopped" }) => void) | undefined;
    let onDelta: ((content: string) => void) | undefined;
    const stoppingTransport = {
      start: vi.fn(async (request: AIChatRequest, callback?: (content: string) => void): Promise<AIChatHandle> => {
        onDelta = callback;
        const completion = new Promise<{ requestId: string; content: string; streamed: boolean; status: "stopped" }>((resolve) => { resolveCompletion = resolve; });
        return { requestId: request.requestId ?? "stop-request", completion, cancel: async () => { resolveCompletion?.({ requestId: request.requestId ?? "stop-request", content: "已生成", streamed: true, status: "stopped" }); } };
      }),
    };
    const pending = store.getState().sendMessage({ tableId: "table-delivery", conversationId: stoppedConversation.id, question: "你好，请停止", runtime: runtime(controls.adapter, stoppingTransport) });
    await vi.waitFor(() => expect(onDelta).toBeDefined());
    expect((await store.getState().sendMessage({ tableId: "table-delivery", conversationId: stoppedConversation.id, question: "你好，重复发送", runtime: runtime(controls.adapter, stoppingTransport) })).ok).toBe(false);
    onDelta?.("已");
    await store.getState().stopConversation(stoppedConversation.id);
    onDelta?.("迟到");
    await pending;
    const stopped = store.getState().conversationsByTable["table-delivery"]?.find((item) => item.id === stoppedConversation.id);
    const answer = stopped?.messages.find((message) => message.role === "assistant");
    expect(answer?.status).toBe("stopped");
    expect(answer?.contentBlocks).toEqual([{ type: "markdown", markdown: "已" }]);
  });

  it("表格分析停止时没有 delta 也会保留完成包中的安全内容", async () => {
    const { persistence } = memoryPersistence();
    const store = createAIConversationStore({ persistence, createId: (() => { let id = 0; return () => `id-${id++}`; })() });
    const controls = createEvaluationTableAdapter();
    await store.getState().loadTable("table-delivery");
    const conversation = await store.getState().createConversation({ tableId: "table-delivery", mode: "table-analysis", providerConfigId: "provider-old", modelId: "model-old" });
    let resolveAnswer: ((value: { requestId: string; content: string; streamed: boolean; status: "stopped" }) => void) | undefined;
    const transport: AIChatTransport = {
      start: vi.fn(async (request: AIChatRequest): Promise<AIChatHandle> => {
        if (request.requestId?.includes("-plan-")) {
          return {
            requestId: request.requestId,
            completion: Promise.resolve({
              requestId: request.requestId,
              content: JSON.stringify({ filters: [], projections: ["title"], groupBy: [], aggregates: [{ id: "count", operation: "count" }], sort: [], limit: 10 }),
              streamed: true,
              status: "complete" as const,
            }),
            cancel: async () => undefined,
          };
        }
        const completion = new Promise<{ requestId: string; content: string; streamed: boolean; status: "stopped" }>((resolve) => { resolveAnswer = resolve; });
        return {
          requestId: request.requestId ?? "answer",
          completion,
          cancel: async () => { resolveAnswer?.({ requestId: request.requestId ?? "answer", content: "停止前已有内容", streamed: true, status: "stopped" }); },
        };
      }),
    };

    const pending = store.getState().sendMessage({
      tableId: "table-delivery",
      conversationId: conversation.id,
      question: "统计整张表",
      runtime: runtime(controls.adapter, transport, "table-analysis"),
    });
    await vi.waitFor(() => expect(transport.start).toHaveBeenCalledTimes(2));
    await store.getState().stopConversation(conversation.id);
    await pending;

    const messages = store.getState().getCurrentConversation()?.messages ?? [];
    const answer = messages[messages.length - 1];
    expect(answer?.status).toBe("stopped");
    expect(answer?.contentBlocks).toEqual([{ type: "markdown", markdown: "分析说明已整理；精确数值、范围和记录仅由本地校验结果呈现。" }]);
  });

  it("清空全部历史会等待进行中请求，迟到片段和完成包不会复活文件或内存会话", async () => {
    const { persistence, conversations } = memoryPersistence();
    const store = createAIConversationStore({ persistence, createId: (() => { let id = 0; return () => `id-${id++}`; })() });
    const controls = createEvaluationTableAdapter();
    await store.getState().loadTable("table-delivery");
    const conversation = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    let onDelta: ((content: string) => void) | undefined;
    let resolveCompletion: ((value: { requestId: string; content: string; streamed: boolean; status: "complete" }) => void) | undefined;
    const transport = {
      start: vi.fn(async (request: AIChatRequest, callback?: (content: string) => void): Promise<AIChatHandle> => {
        onDelta = callback;
        const completion = new Promise<{ requestId: string; content: string; streamed: boolean; status: "complete" }>((resolve) => { resolveCompletion = resolve; });
        return { requestId: request.requestId ?? "clear-request", completion, cancel: async () => undefined };
      }),
    };
    const pending = store.getState().sendMessage({ tableId: "table-delivery", conversationId: conversation.id, question: "请讲一个笑话", runtime: runtime(controls.adapter, transport) });
    await vi.waitFor(() => expect(onDelta).toBeDefined());
    const clearing = store.getState().clearAllHistory();
    onDelta?.("迟到片段");
    resolveCompletion?.({ requestId: "clear-request", content: "迟到完成", streamed: true, status: "complete" });
    await pending;
    await clearing;
    expect(store.getState().conversationsByTable).toEqual({});
    expect(store.getState().activeRequests).toEqual({});
    expect(conversations.size).toBe(0);
  });

  it("清空全部历史会等待已开始但仍在加载的普通会话变更，完成后磁盘与内存仍为空", async () => {
    const base = memoryPersistence();
    let releaseLoad: (() => void) | undefined;
    const delayedLoad = new Promise<void>((resolve) => { releaseLoad = resolve; });
    const persistence: AIConversationPersistence = {
      ...base.persistence,
      loadAIConversations: async (tableId) => {
        await delayedLoad;
        return base.persistence.loadAIConversations(tableId);
      },
    };
    const store = createAIConversationStore({ persistence, createId: () => "delayed-conversation" });
    const creating = store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider", modelId: "model" });
    await vi.waitFor(() => expect(store.getState().loadingTables["table-delivery"]).toBe(true));
    const clearing = store.getState().clearAllHistory();
    releaseLoad?.();
    await creating;
    await clearing;
    expect(store.getState().conversationsByTable).toEqual({});
    expect(base.conversations.size).toBe(0);
  });

  it("删除进行中的单会话会等待请求与保存队列，迟到结果不会复活已删会话", async () => {
    const { persistence, conversations } = memoryPersistence();
    const store = createAIConversationStore({ persistence, createId: (() => { let id = 0; return () => `id-${id++}`; })() });
    const controls = createEvaluationTableAdapter();
    await store.getState().loadTable("table-delivery");
    const conversation = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    let onDelta: ((content: string) => void) | undefined;
    let resolveCompletion: ((value: { requestId: string; content: string; streamed: boolean; status: "complete" }) => void) | undefined;
    const transport: AIChatTransport = {
      start: vi.fn(async (request: AIChatRequest, callback?: (content: string) => void): Promise<AIChatHandle> => {
        onDelta = callback;
        const completion = new Promise<{ requestId: string; content: string; streamed: boolean; status: "complete" }>((resolve) => { resolveCompletion = resolve; });
        return { requestId: request.requestId ?? "delete-request", completion, cancel: async () => undefined };
      }),
    };
    const pending = store.getState().sendMessage({ tableId: "table-delivery", conversationId: conversation.id, question: "请讲一个笑话", runtime: runtime(controls.adapter, transport) });
    await vi.waitFor(() => expect(onDelta).toBeDefined());
    const deleting = store.getState().deleteConversation("table-delivery", conversation.id);
    onDelta?.("迟到片段");
    resolveCompletion?.({ requestId: "delete-request", content: "迟到完成", streamed: true, status: "complete" });
    await pending;
    await expect(deleting).resolves.toEqual({ ok: true });
    expect(store.getState().conversationsByTable["table-delivery"]).toEqual([]);
    expect(conversations.get("table-delivery")?.has(conversation.id)).toBe(false);
  });

  it("通用会话同步首片段在活动请求注册后写入消息", async () => {
    const { persistence } = memoryPersistence();
    const store = createAIConversationStore({ persistence, createId: (() => { let id = 0; return () => `id-${id++}`; })() });
    const controls = createEvaluationTableAdapter();
    await store.getState().loadTable("table-delivery");
    const conversation = await store.getState().createConversation({ tableId: "table-delivery", mode: "general", providerConfigId: "provider-old", modelId: "model-old" });
    let resolveCompletion: ((value: { requestId: string; content: string; streamed: boolean; status: "complete" }) => void) | undefined;
    const transport = {
      start: vi.fn(async (request: AIChatRequest, onDelta?: (content: string) => void): Promise<AIChatHandle> => {
        onDelta?.("首片段");
        const completion = new Promise<{ requestId: string; content: string; streamed: boolean; status: "complete" }>((resolve) => { resolveCompletion = resolve; });
        return {
          requestId: request.requestId ?? "answer",
          completion,
          cancel: async () => undefined,
        };
      }),
    };

    const pending = store.getState().sendMessage({
      tableId: "table-delivery",
      conversationId: conversation.id,
      question: "你好",
      runtime: runtime(controls.adapter, transport),
    });
    await vi.waitFor(() => {
      const messages = store.getState().getCurrentConversation()?.messages ?? [];
      expect(messages[messages.length - 1]?.contentBlocks).toEqual([{ type: "markdown", markdown: "首片段" }]);
    });
    resolveCompletion?.({ requestId: "answer", content: "首片段完成", streamed: true, status: "complete" });
    await pending;
  });
});

function messageText(message: import("../types/ai").AIMessage): string {
  return message.contentBlocks.filter((block) => block.type === "markdown").map((block) => block.markdown).join("\n");
}

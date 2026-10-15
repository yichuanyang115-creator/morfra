import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  deleteAIConversation,
  loadAIConversationIndex,
  loadAIConversations,
  saveAIConversation,
  clearAllAIConversationData,
} from "../lib/ai/persistence";
import {
  resolveChatContext,
} from "../lib/ai/chatOrchestrator";
import {
  createMessage,
  messageText,
  recoverInterruptedConversation,
} from "../lib/ai/messagePersistence";
import { toAIProviderError } from "../lib/ai/providerClient";
import type { AIConversation } from "../types/ai";
import type {
  AIConversationActionResult,
  AIConversationPersistence,
  AIConversationState,
  AIConversationStoreOptions,
} from "./aiConversationStoreTypes";
import { sortRecent } from "./aiConversationStoreTypes";
import { runConversationRequest } from "./aiConversationStoreRequest";
import { createConversationMutations } from "./aiConversationStoreMutations";

export type {
  AIActiveRequest,
  AIConversationActionResult,
  AIConversationPersistence,
  AIConversationRuntime,
  AIConversationState,
  AIConversationStoreOptions,
} from "./aiConversationStoreTypes";

export function createAIConversationStore(options: AIConversationStoreOptions = {}) {
  const persistence: AIConversationPersistence = {
    loadAIConversationIndex,
    loadAIConversations,
    saveAIConversation,
    deleteAIConversation,
    clearAllAIConversationData,
    ...options.persistence,
  };
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? nanoid;
  const saveQueues = new Map<string, Promise<void>>();
  const requestTasks = new Map<string, Promise<AIConversationActionResult>>();
  const mutationTasks = new Set<Promise<unknown>>();
  const deletedConversationIds = new Set<string>();
  let latestLoadGeneration = 0;
  let historyGeneration = 0;
  let clearHistoryTask: Promise<void> | null = null;

  return create<AIConversationState>((set, get) => {
    const queueSave = (conversation: AIConversation, makeCurrent = false): Promise<void> => {
      const previous = saveQueues.get(conversation.id) ?? Promise.resolve();
      const next = previous.catch(() => undefined).then(() => persistence.saveAIConversation(conversation, makeCurrent));
      const tracked = next.finally(() => {
        if (saveQueues.get(conversation.id) === tracked) saveQueues.delete(conversation.id);
      });
      saveQueues.set(conversation.id, tracked);
      return tracked;
    };

    const findConversation = (tableId: string, conversationId: string): AIConversation | null =>
      deletedConversationIds.has(conversationId)
        ? null
        : get().conversationsByTable[tableId]?.find((conversation) => conversation.id === conversationId) ?? null;

    const putConversation = (conversation: AIConversation): void => {
      set((state) => {
        const previous = state.conversationsByTable[conversation.tableId] ?? [];
        const withoutCurrent = previous.filter((item) => item.id !== conversation.id);
        return { conversationsByTable: { ...state.conversationsByTable, [conversation.tableId]: sortRecent([...withoutCurrent, conversation]) } };
      });
    };

    const setPersistenceError = (): void => set({ persistenceError: "AI 对话保存失败，请检查应用数据目录" });

    const setActiveRequest = (conversationId: string, request: AIConversationState["activeRequests"][string]): void => {
      set((state) => {
        const activeRequests = { ...state.activeRequests };
        if (request) activeRequests[conversationId] = request;
        else delete activeRequests[conversationId];
        return { activeRequests };
      });
    };

    const trackRequest = (conversationId: string, task: Promise<AIConversationActionResult>): Promise<AIConversationActionResult> => {
      const tracked = task.finally(() => {
        if (requestTasks.get(conversationId) === tracked) requestTasks.delete(conversationId);
      });
      requestTasks.set(conversationId, tracked);
      return tracked;
    };

    const trackMutation = <T>(operation: () => Promise<T>): Promise<T> => {
      const tracked = operation().finally(() => mutationTasks.delete(tracked));
      mutationTasks.add(tracked);
      return tracked;
    };

    const drainSaveQueue = async (conversationId?: string): Promise<void> => {
      do {
        const pending = conversationId
          ? [saveQueues.get(conversationId)].filter((task): task is Promise<void> => Boolean(task))
          : [...saveQueues.values()];
        if (pending.length === 0) return;
        await Promise.allSettled(pending);
      } while (conversationId ? saveQueues.has(conversationId) : saveQueues.size > 0);
    };

    const requestDeps = (conversationId: string, generation: number) => {
      const canWrite = () => generation === historyGeneration && !deletedConversationIds.has(conversationId);
      return {
        createId,
        now,
        findConversation: (tableId: string, targetConversationId: string) => canWrite() ? findConversation(tableId, targetConversationId) : null,
        putConversation: (conversation: AIConversation) => { if (canWrite()) putConversation(conversation); },
        queueSave: (conversation: AIConversation, makeCurrent?: boolean) => canWrite() ? queueSave(conversation, makeCurrent) : Promise.resolve(),
        setPersistenceError: () => { if (canWrite()) setPersistenceError(); },
        setActiveRequest: (targetConversationId: string, request: AIConversationState["activeRequests"][string]) => {
          if (canWrite() || !request) setActiveRequest(targetConversationId, request);
        },
        getActiveRequest: (targetConversationId: string) => get().activeRequests[targetConversationId],
      };
    };

    const mutationActions = createConversationMutations({
      get,
      set,
      now,
      createId,
      waitForClear: async () => { if (clearHistoryTask) await clearHistoryTask; },
      trackMutation,
      findConversation,
      putConversation,
      queueSave,
      drainSaveQueue,
      deletePersistedConversation: persistence.deleteAIConversation,
      deletedConversationIds,
      requestTask: (conversationId) => requestTasks.get(conversationId),
    });

    return {
      activeTableId: null,
      conversationsByTable: {},
      currentConversationIdByTable: {},
      loadedTables: {},
      loadingTables: {},
      storageIssuesByTable: {},
      activeRequests: {},
      persistenceError: null,
      loadTable: async (tableId) => {
        if (clearHistoryTask) await clearHistoryTask;
        const generation = ++latestLoadGeneration;
        set((state) => ({ activeTableId: tableId, loadingTables: { ...state.loadingTables, [tableId]: true } }));
        const index = await persistence.loadAIConversationIndex(tableId);
        const loaded = await persistence.loadAIConversations(tableId);
        if (generation !== latestLoadGeneration) return;
        const conversations: AIConversation[] = [];
        for (const item of loaded.value) {
          const recovered = recoverInterruptedConversation(item);
          conversations.push(recovered.conversation);
          if (recovered.changed) await queueSave(recovered.conversation).catch(setPersistenceError);
        }
        if (generation !== latestLoadGeneration) return;
        const currentId = index.value.currentConversationId && conversations.some((item) => item.id === index.value.currentConversationId)
          ? index.value.currentConversationId
          : conversations[0]?.id ?? null;
        set((state) => ({
          activeTableId: tableId,
          conversationsByTable: { ...state.conversationsByTable, [tableId]: sortRecent(conversations) },
          currentConversationIdByTable: { ...state.currentConversationIdByTable, [tableId]: currentId },
          loadedTables: { ...state.loadedTables, [tableId]: true },
          loadingTables: { ...state.loadingTables, [tableId]: false },
          storageIssuesByTable: { ...state.storageIssuesByTable, [tableId]: [...index.issues, ...loaded.issues] },
        }));
      },
      switchTable: async (tableId) => get().loadTable(tableId),
      getCurrentConversation: (tableId) => {
        const targetTableId = tableId ?? get().activeTableId;
        if (!targetTableId) return null;
        const currentId = get().currentConversationIdByTable[targetTableId];
        return currentId ? findConversation(targetTableId, currentId) : null;
      },
      ...mutationActions,
      sendMessage: async ({ tableId, conversationId, question, selectionReferenced = false, selectedRecordIds, runtime }) => {
        if (clearHistoryTask) await clearHistoryTask;
        const trimmed = question.trim();
        const id = conversationId ?? get().currentConversationIdByTable[tableId] ?? null;
        const conversation = id ? findConversation(tableId, id) : null;
        if (!trimmed) return { ok: false, message: "问题不能为空" };
        if (!conversation) return { ok: false, message: "请先创建或选择会话" };
        if (get().activeRequests[conversation.id]) return { ok: false, message: "同一会话正在生成中" };
        const selected = selectedRecordIds ?? runtime.adapter.getSelectedRecordIds(tableId);
        const resolved = resolveChatContext({ mode: conversation.mode, question: trimmed, selectionReferenced, selectedRecordIds: selected });
        const providerConfigId = runtime.providerConfig.id.trim();
        const modelId = runtime.modelId?.trim() || runtime.providerConfig.defaultModelId.trim();
        if (!providerConfigId || !modelId) return { ok: false, message: "请先选择可用的服务配置和模型" };
        const currentWithModel = conversation.providerConfigId === providerConfigId && conversation.modelId === modelId
          ? conversation
          : { ...conversation, providerConfigId, modelId, updatedAt: now() };
        const firstQuestion = currentWithModel.messages.every((message) => message.role !== "user");
        const user = createMessage({ id: createId(), conversationId: currentWithModel.id, role: "user", content: trimmed, contextRef: resolved.contextRef, providerConfigId, modelId, status: "complete" });
        const assistant = createMessage({ id: createId(), conversationId: currentWithModel.id, role: "assistant", content: "", contextRef: resolved.contextRef, providerConfigId, modelId, status: "pending" });
        const next = { ...currentWithModel, messages: [...currentWithModel.messages, user, assistant], updatedAt: now() };
        putConversation(next);
        set((state) => ({ currentConversationIdByTable: { ...state.currentConversationIdByTable, [tableId]: next.id } }));
        const generation = historyGeneration;
        return trackRequest(conversation.id, runConversationRequest(
          { conversation: next, previousMessages: currentWithModel.messages, question: trimmed, contextRef: resolved.contextRef, assistantMessageId: assistant.id, runtime, firstQuestion },
          requestDeps(conversation.id, generation),
        ));
      },
      retryMessage: async ({ tableId, conversationId, assistantMessageId, runtime }) => {
        if (clearHistoryTask) await clearHistoryTask;
        const conversation = findConversation(tableId, conversationId);
        if (!conversation) return { ok: false, message: "会话不存在" };
        if (get().activeRequests[conversationId]) return { ok: false, message: "同一会话正在生成中" };
        const assistantIndex = conversation.messages.findIndex((message) => message.id === assistantMessageId && (message.status === "failed" || message.status === "stopped"));
        const user = assistantIndex > 0 ? conversation.messages.slice(0, assistantIndex).reverse().find((message) => message.role === "user") : undefined;
        if (!user) return { ok: false, message: "找不到可重试的问题" };
        const providerConfigId = runtime.providerConfig.id.trim();
        const modelId = runtime.modelId?.trim() || runtime.providerConfig.defaultModelId.trim();
        if (!providerConfigId || !modelId) return { ok: false, message: "请先选择可用的服务配置和模型" };
        const assistant = createMessage({ id: createId(), conversationId, role: "assistant", content: "", contextRef: user.contextRef, providerConfigId, modelId, status: "pending" });
        const next = { ...conversation, providerConfigId, modelId, messages: [...conversation.messages, assistant], updatedAt: now() };
        putConversation(next);
        const generation = historyGeneration;
        return trackRequest(conversationId, runConversationRequest(
          { conversation: next, previousMessages: conversation.messages, question: messageText(user), contextRef: user.contextRef, assistantMessageId: assistant.id, runtime, firstQuestion: false },
          requestDeps(conversationId, generation),
        ));
      },
      stopConversation: async (conversationId) => {
        const active = get().activeRequests[conversationId];
        if (!active) return { ok: true };
        try {
          setActiveRequest(conversationId, { ...active, acceptDeltas: false });
          await get().activeRequests[conversationId]?.stop();
          return { ok: true, requestId: active.requestId };
        } catch (error) {
          return { ok: false, message: toAIProviderError(error).message };
        }
      },
      copyAnswer: (tableId, conversationId, assistantMessageId) => {
        const message = findConversation(tableId, conversationId)?.messages.find((item) => item.id === assistantMessageId);
        return message ? messageText(message) : "";
      },
      clearAllHistory: async () => {
        if (!clearHistoryTask) {
          const task = (async () => {
            historyGeneration += 1;
            latestLoadGeneration += 1;
            const mutationsBeforeClear = [...mutationTasks];
            await Promise.allSettled(mutationsBeforeClear);
            await Promise.all(Object.keys(get().activeRequests).map((conversationId) => get().stopConversation(conversationId)));
            while (requestTasks.size > 0) await Promise.allSettled([...requestTasks.values()]);
            await drainSaveQueue();
            await persistence.clearAllAIConversationData();
            deletedConversationIds.clear();
            set({ conversationsByTable: {}, currentConversationIdByTable: {}, loadedTables: {}, loadingTables: {}, storageIssuesByTable: {}, activeRequests: {} });
          })();
          clearHistoryTask = task.finally(() => { clearHistoryTask = null; });
        }
        await clearHistoryTask;
      },
    };
  });
}

export const useAIConversationStore = createAIConversationStore();

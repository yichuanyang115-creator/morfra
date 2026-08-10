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
import {
  AI_CONVERSATION_DEFAULT_TITLES,
} from "../lib/ai/titleGenerator";
import { toAIProviderError } from "../lib/ai/providerClient";
import type { AIConversation } from "../types/ai";
import type {
  AIConversationPersistence,
  AIConversationState,
  AIConversationStoreOptions,
} from "./aiConversationStoreTypes";
import { sortRecent } from "./aiConversationStoreTypes";
import { runConversationRequest } from "./aiConversationStoreRequest";

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
  let latestLoadGeneration = 0;

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
      get().conversationsByTable[tableId]?.find((conversation) => conversation.id === conversationId) ?? null;

    const putConversation = (conversation: AIConversation): void => {
      set((state) => {
        const previous = state.conversationsByTable[conversation.tableId] ?? [];
        const withoutCurrent = previous.filter((item) => item.id !== conversation.id);
        return { conversationsByTable: { ...state.conversationsByTable, [conversation.tableId]: sortRecent([...withoutCurrent, conversation]) } };
      });
    };

    const setPersistenceError = (): void => set({ persistenceError: "AI 对话保存失败，请检查应用数据目录" });

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
        const generation = ++latestLoadGeneration;
        set((state) => ({ activeTableId: tableId, loadingTables: { ...state.loadingTables, [tableId]: true } }));
        const index = await persistence.loadAIConversationIndex(tableId);
        const loaded = await persistence.loadAIConversations(tableId);
        if (generation !== latestLoadGeneration) {
          set((state) => ({ loadingTables: { ...state.loadingTables, [tableId]: false } }));
          return;
        }
        const conversations: AIConversation[] = [];
        for (const item of loaded.value) {
          const recovered = recoverInterruptedConversation(item);
          conversations.push(recovered.conversation);
          if (recovered.changed) await queueSave(recovered.conversation).catch(setPersistenceError);
        }
        if (generation !== latestLoadGeneration) {
          set((state) => ({ loadingTables: { ...state.loadingTables, [tableId]: false } }));
          return;
        }
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
      createConversation: async ({ tableId, mode, providerConfigId, modelId }) => {
        if (!get().loadedTables[tableId]) await get().loadTable(tableId);
        const timestamp = now();
        const conversation: AIConversation = {
          id: createId(),
          tableId,
          mode,
          title: AI_CONVERSATION_DEFAULT_TITLES[mode],
          providerConfigId,
          modelId,
          messages: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        putConversation(conversation);
        set((state) => ({ currentConversationIdByTable: { ...state.currentConversationIdByTable, [tableId]: conversation.id } }));
        await queueSave(conversation, true);
        return conversation;
      },
      selectConversation: async (tableId, conversationId) => {
        const conversation = findConversation(tableId, conversationId);
        if (!conversation) return { ok: false, message: "会话不存在" };
        if (get().activeRequests[conversationId]) return { ok: false, message: "会话正在生成中，请先停止当前请求" };
        const touched = { ...conversation, updatedAt: now() };
        putConversation(touched);
        set((state) => ({ activeTableId: tableId, currentConversationIdByTable: { ...state.currentConversationIdByTable, [tableId]: conversationId } }));
        await queueSave(touched, true);
        return { ok: true };
      },
      renameConversation: async (tableId, conversationId, title) => {
        const conversation = findConversation(tableId, conversationId);
        const normalized = title.replace(/\s+/gu, " ").trim();
        if (!conversation) return { ok: false, message: "会话不存在" };
        if (!normalized) return { ok: false, message: "会话标题不能为空" };
        const renamed = { ...conversation, title: normalized, updatedAt: now() };
        putConversation(renamed);
        await queueSave(renamed, true);
        return { ok: true };
      },
      deleteConversation: async (tableId, conversationId) => {
        const conversation = findConversation(tableId, conversationId);
        if (!conversation) return { ok: false, message: "会话不存在" };
        await get().stopConversation(conversationId);
        await persistence.deleteAIConversation(tableId, conversationId);
        const remaining = (get().conversationsByTable[tableId] ?? []).filter((item) => item.id !== conversationId);
        const nextCurrent = get().currentConversationIdByTable[tableId] === conversationId ? remaining[0]?.id ?? null : get().currentConversationIdByTable[tableId] ?? null;
        set((state) => ({ conversationsByTable: { ...state.conversationsByTable, [tableId]: remaining }, currentConversationIdByTable: { ...state.currentConversationIdByTable, [tableId]: nextCurrent } }));
        return { ok: true };
      },
      setConversationModel: async (tableId, conversationId, providerConfigId, modelId) => {
        const conversation = findConversation(tableId, conversationId);
        const normalizedModelId = modelId.trim();
        if (!conversation) return { ok: false, message: "会话不存在" };
        if (!providerConfigId.trim() || !normalizedModelId) return { ok: false, message: "服务配置和模型不能为空" };
        if (get().activeRequests[conversationId]) return { ok: false, message: "生成期间不能切换模型" };
        const updated = { ...conversation, providerConfigId: providerConfigId.trim(), modelId: normalizedModelId, updatedAt: now() };
        putConversation(updated);
        await queueSave(updated, true);
        return { ok: true };
      },
      sendMessage: async ({ tableId, conversationId, question, selectionReferenced = false, selectedRecordIds, runtime }) => {
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
        return runConversationRequest({ conversation: next, previousMessages: currentWithModel.messages, question: trimmed, contextRef: resolved.contextRef, assistantMessageId: assistant.id, runtime, firstQuestion }, {
          createId,
          now,
          findConversation,
          putConversation,
          queueSave,
          setPersistenceError,
          setActiveRequest: (conversationId, request) => set((state) => ({ activeRequests: { ...state.activeRequests, [conversationId]: request } })),
          getActiveRequest: (conversationId) => get().activeRequests[conversationId],
        });
      },
      retryMessage: async ({ tableId, conversationId, assistantMessageId, runtime }) => {
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
        return runConversationRequest({ conversation: next, previousMessages: conversation.messages, question: messageText(user), contextRef: user.contextRef, assistantMessageId: assistant.id, runtime, firstQuestion: false }, {
          createId,
          now,
          findConversation,
          putConversation,
          queueSave,
          setPersistenceError,
          setActiveRequest: (id, request) => set((state) => ({ activeRequests: { ...state.activeRequests, [id]: request } })),
          getActiveRequest: (id) => get().activeRequests[id],
        });
      },
      stopConversation: async (conversationId) => {
        const active = get().activeRequests[conversationId];
        if (!active) return { ok: true };
        try {
          set((state) => ({ activeRequests: { ...state.activeRequests, [conversationId]: active ? { ...active, acceptDeltas: false } : undefined } }));
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
        await Promise.all(Object.keys(get().activeRequests).map((conversationId) => get().stopConversation(conversationId)));
        await persistence.clearAllAIConversationData();
        set({ conversationsByTable: {}, currentConversationIdByTable: {}, loadedTables: {}, storageIssuesByTable: {}, activeRequests: {} });
      },
    };
  });
}

export const useAIConversationStore = createAIConversationStore();

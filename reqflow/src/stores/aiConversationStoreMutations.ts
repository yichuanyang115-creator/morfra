import type { StoreApi } from "zustand";
import { AI_CONVERSATION_DEFAULT_TITLES } from "../lib/ai/titleGenerator";
import type { AIConversation } from "../types/ai";
import type { AIConversationState } from "./aiConversationStoreTypes";

type MutationActions = Pick<AIConversationState,
  "createConversation" | "selectConversation" | "renameConversation" | "deleteConversation" | "setConversationModel"
>;

interface MutationDependencies {
  get: () => AIConversationState;
  set: StoreApi<AIConversationState>["setState"];
  now: () => string;
  createId: () => string;
  waitForClear: () => Promise<void>;
  trackMutation: <T>(operation: () => Promise<T>) => Promise<T>;
  findConversation: (tableId: string, conversationId: string) => AIConversation | null;
  putConversation: (conversation: AIConversation) => void;
  queueSave: (conversation: AIConversation, makeCurrent?: boolean) => Promise<void>;
  drainSaveQueue: (conversationId?: string) => Promise<void>;
  deletePersistedConversation: (tableId: string, conversationId: string) => Promise<void>;
  deletedConversationIds: Set<string>;
  requestTask: (conversationId: string) => Promise<unknown> | undefined;
}

export function createConversationMutations(deps: MutationDependencies): MutationActions {
  const { get, set, now, createId, trackMutation, findConversation, putConversation, queueSave } = deps;
  return {
    createConversation: async ({ tableId, mode, providerConfigId, modelId }) => trackMutation(async () => {
      await deps.waitForClear();
      if (!get().loadedTables[tableId]) await get().loadTable(tableId);
      const timestamp = now();
      const conversation: AIConversation = { id: createId(), tableId, mode, title: AI_CONVERSATION_DEFAULT_TITLES[mode], providerConfigId, modelId, messages: [], createdAt: timestamp, updatedAt: timestamp };
      putConversation(conversation);
      set((state) => ({ currentConversationIdByTable: { ...state.currentConversationIdByTable, [tableId]: conversation.id } }));
      await queueSave(conversation, true);
      return conversation;
    }),
    selectConversation: async (tableId, conversationId) => trackMutation(async () => {
      await deps.waitForClear();
      const conversation = findConversation(tableId, conversationId);
      if (!conversation) return { ok: false, message: "会话不存在" };
      if (get().activeRequests[conversationId]) return { ok: false, message: "会话正在生成中，请先停止当前请求" };
      const touched = { ...conversation, updatedAt: now() };
      putConversation(touched);
      set((state) => ({ activeTableId: tableId, currentConversationIdByTable: { ...state.currentConversationIdByTable, [tableId]: conversationId } }));
      await queueSave(touched, true);
      return { ok: true };
    }),
    renameConversation: async (tableId, conversationId, title) => trackMutation(async () => {
      await deps.waitForClear();
      const conversation = findConversation(tableId, conversationId);
      const normalized = title.replace(/\s+/gu, " ").trim();
      if (!conversation) return { ok: false, message: "会话不存在" };
      if (!normalized) return { ok: false, message: "会话标题不能为空" };
      const renamed = { ...conversation, title: normalized, updatedAt: now() };
      putConversation(renamed);
      await queueSave(renamed, true);
      return { ok: true };
    }),
    deleteConversation: async (tableId, conversationId) => trackMutation(async () => {
      await deps.waitForClear();
      const conversation = findConversation(tableId, conversationId);
      if (!conversation) return { ok: false, message: "会话不存在" };
      deps.deletedConversationIds.add(conversationId);
      try {
        await get().stopConversation(conversationId);
        const requestTask = deps.requestTask(conversationId);
        if (requestTask) await requestTask;
        await deps.drainSaveQueue(conversationId);
        await deps.deletePersistedConversation(tableId, conversationId);
        const remaining = (get().conversationsByTable[tableId] ?? []).filter((item) => item.id !== conversationId);
        const current = get().currentConversationIdByTable[tableId];
        const nextCurrent = current === conversationId ? remaining[0]?.id ?? null : current ?? null;
        set((state) => ({ conversationsByTable: { ...state.conversationsByTable, [tableId]: remaining }, currentConversationIdByTable: { ...state.currentConversationIdByTable, [tableId]: nextCurrent } }));
        return { ok: true };
      } catch (error) {
        deps.deletedConversationIds.delete(conversationId);
        throw error;
      }
    }),
    setConversationModel: async (tableId, conversationId, providerConfigId, modelId) => trackMutation(async () => {
      await deps.waitForClear();
      const conversation = findConversation(tableId, conversationId);
      const normalizedModelId = modelId.trim();
      if (!conversation) return { ok: false, message: "会话不存在" };
      if (!providerConfigId.trim() || !normalizedModelId) return { ok: false, message: "服务配置和模型不能为空" };
      if (get().activeRequests[conversationId]) return { ok: false, message: "生成期间不能切换模型" };
      const updated = { ...conversation, providerConfigId: providerConfigId.trim(), modelId: normalizedModelId, updatedAt: now() };
      putConversation(updated);
      await queueSave(updated, true);
      return { ok: true };
    }),
  };
}

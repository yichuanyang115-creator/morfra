import {
  startChatOrchestration,
} from "../lib/ai/chatOrchestrator";
import {
  appendStreamingDelta,
  messageText,
  updateMessage,
} from "../lib/ai/messagePersistence";
import { AI_CONVERSATION_DEFAULT_TITLES, generateConversationTitle } from "../lib/ai/titleGenerator";
import { toAIProviderError } from "../lib/ai/providerClient";
import type { AIConversation, AIMessage } from "../types/ai";
import type {
  AIActiveRequest,
  AIConversationActionResult,
  AIConversationRuntime,
} from "./aiConversationStoreTypes";

export interface AIConversationRequestRunnerInput {
  conversation: AIConversation;
  previousMessages: AIMessage[];
  question: string;
  contextRef: AIMessage["contextRef"];
  assistantMessageId: string;
  runtime: AIConversationRuntime;
  firstQuestion: boolean;
}

export interface AIConversationRequestRunnerDeps {
  createId: () => string;
  now: () => string;
  findConversation: (tableId: string, conversationId: string) => AIConversation | null;
  putConversation: (conversation: AIConversation) => void;
  queueSave: (conversation: AIConversation, makeCurrent?: boolean) => Promise<void>;
  setPersistenceError: () => void;
  setActiveRequest: (conversationId: string, request: AIActiveRequest | undefined) => void;
  getActiveRequest: (conversationId: string) => AIActiveRequest | undefined;
}

export async function runConversationRequest(
  input: AIConversationRequestRunnerInput,
  deps: AIConversationRequestRunnerDeps,
): Promise<AIConversationActionResult> {
  const requestToken = deps.createId();
  let handle: ReturnType<typeof startChatOrchestration> | null = null;
  let stopRequested = false;
  const stop = async (): Promise<void> => {
    stopRequested = true;
    await handle?.stop();
  };
  deps.setActiveRequest(input.conversation.id, { requestId: requestToken, assistantMessageId: input.assistantMessageId, acceptDeltas: true, stop });
  try {
    handle = startChatOrchestration({
      tableId: input.conversation.tableId,
      conversationId: input.conversation.id,
      mode: input.conversation.mode,
      question: input.question,
      providerConfigId: input.runtime.providerConfig.id,
      baseUrl: input.runtime.providerConfig.baseUrl,
      modelId: input.runtime.modelId?.trim() || input.runtime.providerConfig.defaultModelId,
      dataExfiltrationConfirmed: input.runtime.dataExfiltrationConfirmed,
      adapter: input.runtime.adapter,
      previousMessages: input.previousMessages,
      selectionReferenced: input.contextRef?.type === "selectedRecords",
      selectedRecordIds: input.contextRef?.type === "selectedRecords" ? input.contextRef.recordIds : undefined,
      transport: input.runtime.transport,
      onDelta: (delta) => {
        const active = deps.getActiveRequest(input.conversation.id);
        if (active?.requestId !== requestToken || !active.acceptDeltas) return;
        const current = deps.findConversation(input.conversation.tableId, input.conversation.id);
        if (!current) return;
        const next = appendStreamingDelta(current, input.assistantMessageId, delta);
        deps.putConversation(next);
        void deps.queueSave(next).catch(deps.setPersistenceError);
      },
    });
    if (stopRequested) await handle.stop();
    await deps.queueSave(input.conversation);
    const result = await handle.completion;
    const current = deps.findConversation(input.conversation.tableId, input.conversation.id);
    if (current) {
      const existing = current.messages.find((message) => message.id === input.assistantMessageId);
      const existingBlocks = existing?.contentBlocks ?? [];
      const hasVisibleStreamedContent = existingBlocks.some((block) => block.type !== "markdown" || block.markdown.trim().length > 0);
      const contentBlocks = result.status === "complete" || result.status === "clarification"
        ? result.answerBlocks
        : hasVisibleStreamedContent
          ? existingBlocks
          : result.content
            ? [{ type: "markdown" as const, markdown: result.content }]
            : [];
      const next = updateMessage(current, input.assistantMessageId, {
        contentBlocks,
        contextRef: result.contextRef,
        status: result.status === "complete" || result.status === "clarification" ? "complete" : result.status,
        providerConfigId: input.runtime.providerConfig.id,
        modelId: input.runtime.modelId?.trim() || input.runtime.providerConfig.defaultModelId,
        errorMessage: result.errorMessage,
      });
      deps.putConversation(next);
      await deps.queueSave(next);
    }
    if (input.firstQuestion) {
      const title = await generateConversationTitle(input.question, input.runtime.generateTitle);
      const titled = deps.findConversation(input.conversation.tableId, input.conversation.id);
      if (titled && titled.title === AI_CONVERSATION_DEFAULT_TITLES[titled.mode]) {
        const next = { ...titled, title, updatedAt: deps.now() };
        deps.putConversation(next);
        await deps.queueSave(next, true);
      }
    }
    return result.status === "complete" || result.status === "clarification"
      ? { ok: true, requestId: result.requestId }
      : { ok: false, message: result.errorMessage ?? (result.status === "stopped" ? "请求已停止" : "AI 请求失败"), requestId: result.requestId };
  } catch (error) {
    await handle?.stop().catch(() => undefined);
    const safe = toAIProviderError(error);
    const current = deps.findConversation(input.conversation.tableId, input.conversation.id);
    if (current) {
      const failed = updateMessage(current, input.assistantMessageId, { status: "failed", errorMessage: safe.message });
      deps.putConversation(failed);
      await deps.queueSave(failed).catch(deps.setPersistenceError);
    }
    return { ok: false, message: safe.message, requestId: handle?.requestId ?? requestToken };
  } finally {
    const active = deps.getActiveRequest(input.conversation.id);
    if (active?.requestId === requestToken) deps.setActiveRequest(input.conversation.id, undefined);
  }
}

export function retryQuestion(message: AIMessage): string {
  return messageText(message);
}

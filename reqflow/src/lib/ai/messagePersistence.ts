import type { AIAnswerBlock, AIConversation, AIContextRef, AIMessage, AIMessageRole, AIMessageStatus } from "../../types/ai";

function now(): string {
  return new Date().toISOString();
}

export function answerBlocksText(blocks: AIAnswerBlock[]): string {
  return blocks.map((block) => {
    if (block.type === "markdown") return block.markdown;
    if (block.type === "metrics") return block.items.map((item) => `${item.label}: ${String(item.value)}${item.unit ?? ""}`).join("\n");
    if (block.type === "recordRefs") return block.records.map((record) => `${record.title} (${record.recordId})`).join("\n");
    const header = block.columns.map((column) => column.label).join(" | ");
    const rows = block.rows.map((row) => block.columns.map((column) => String(row[column.id] ?? "")).join(" | "));
    return [header, ...rows].join("\n");
  }).filter(Boolean).join("\n").trim();
}

export function messageText(message: AIMessage): string {
  return answerBlocksText(message.contentBlocks);
}

export function createMessage(input: {
  id: string;
  conversationId: string;
  role: AIMessageRole;
  content: string;
  contextRef: AIContextRef | null;
  providerConfigId: string | null;
  modelId: string | null;
  status: AIMessageStatus;
}): AIMessage {
  return {
    id: input.id,
    conversationId: input.conversationId,
    role: input.role,
    contentBlocks: [{ type: "markdown", markdown: input.content }],
    contextRef: input.contextRef,
    providerConfigId: input.providerConfigId,
    modelId: input.modelId,
    status: input.status,
    createdAt: now(),
  };
}

export function updateMessage(
  conversation: AIConversation,
  messageId: string,
  update: Partial<Pick<AIMessage, "contentBlocks" | "status" | "contextRef" | "providerConfigId" | "modelId" | "errorMessage">>,
): AIConversation {
  const messages = conversation.messages.map((message) => message.id === messageId ? { ...message, ...update } : message);
  return { ...conversation, messages, updatedAt: now() };
}

export function appendStreamingDelta(conversation: AIConversation, messageId: string, delta: string): AIConversation {
  if (!delta) return conversation;
  const messages = conversation.messages.map((message) => {
    if (message.id !== messageId) return message;
    const current = message.contentBlocks[0];
    const markdown = current?.type === "markdown" ? current.markdown : "";
    return { ...message, contentBlocks: [{ type: "markdown" as const, markdown: `${markdown}${delta}` }], status: "streaming" as const, errorMessage: undefined };
  });
  return { ...conversation, messages, updatedAt: now() };
}

/** 应用重启后没有可恢复的网络请求；保留已收到文本并把未决消息收口为 stopped。 */
export function recoverInterruptedConversation(conversation: AIConversation): { conversation: AIConversation; changed: boolean } {
  let changed = false;
  const messages = conversation.messages.map((message) => {
    if (message.status !== "pending" && message.status !== "streaming") return message;
    changed = true;
    return { ...message, status: "stopped" as const, errorMessage: undefined };
  });
  return changed
    ? { conversation: { ...conversation, messages, updatedAt: now() }, changed: true }
    : { conversation, changed: false };
}

export function replaceMessageStatus(
  conversation: AIConversation,
  messageId: string,
  status: AIMessageStatus,
  errorMessage?: string,
): AIConversation {
  return updateMessage(conversation, messageId, { status, errorMessage });
}

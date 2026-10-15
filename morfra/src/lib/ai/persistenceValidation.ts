import {
  AI_PERSISTENCE_VERSION,
  type AIAnswerBlock,
  type AIContextRef,
  type AIConversation,
  type AIConversationDocument,
  type AIConversationIndexDocument,
  type AIConversationIndexEntry,
  type AIMessage,
  type AIPanelPreference,
  type AIPanelPreferenceDocument,
  type AIProviderConfig,
  type AIProviderConfigDocument,
  type AIPrimitive,
} from "../../types/ai";
import { getAIProviderBaseUrlIssue, getAIProviderModelIssue, getAIProviderNameIssue } from "./aiProviderValidation";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isPrimitive(value: unknown): value is AIPrimitive {
  return value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value));
}

function isContextRef(value: unknown): value is AIContextRef {
  if (!isRecord(value)) return false;
  if (value.type === "none" || value.type === "fullTable") return true;
  return value.type === "selectedRecords"
    && Array.isArray(value.recordIds)
    && value.recordIds.every(isString);
}

function isAnswerBlock(value: unknown): value is AIAnswerBlock {
  if (!isRecord(value)) return false;
  if (value.type === "markdown") return isString(value.markdown);
  if (value.type === "metrics") {
    return Array.isArray(value.items) && value.items.every((item) => (
      isRecord(item) && isString(item.label) && isPrimitive(item.value)
      && (item.unit === undefined || isString(item.unit))
    ));
  }
  if (value.type === "table") {
    return Array.isArray(value.columns)
      && value.columns.every((column) => isRecord(column) && isString(column.id) && isString(column.label))
      && Array.isArray(value.rows)
      && value.rows.every((row) => isRecord(row) && Object.values(row).every(isPrimitive));
  }
  if (value.type === "recordRefs") {
    return Array.isArray(value.records)
      && value.records.every((record) => isRecord(record) && isString(record.recordId) && isString(record.title));
  }
  return false;
}

function isMessage(value: unknown): value is AIMessage {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.conversationId)
    && (value.role === "user" || value.role === "assistant")
    && Array.isArray(value.contentBlocks)
    && value.contentBlocks.every(isAnswerBlock)
    && (value.contextRef === null || isContextRef(value.contextRef))
    && isNullableString(value.providerConfigId)
    && isNullableString(value.modelId)
    && ["pending", "streaming", "complete", "stopped", "failed"].includes(String(value.status))
    && isString(value.createdAt)
    && (value.errorMessage === undefined || isString(value.errorMessage));
}

export function isConversation(value: unknown): value is AIConversation {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.tableId)
    && (value.mode === "table-analysis" || value.mode === "general")
    && isString(value.title)
    && isString(value.providerConfigId)
    && isString(value.modelId)
    && Array.isArray(value.messages)
    && value.messages.every((message) => isMessage(message) && message.conversationId === value.id)
    && isString(value.createdAt)
    && isString(value.updatedAt);
}

function isIndexEntry(value: unknown): value is AIConversationIndexEntry {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.tableId)
    && (value.mode === "table-analysis" || value.mode === "general")
    && isString(value.title)
    && isString(value.providerConfigId)
    && isString(value.modelId)
    && isString(value.createdAt)
    && isString(value.updatedAt);
}

export function parseConversationIndex(value: unknown, tableId: string): AIConversationIndexDocument | null {
  if (!isRecord(value) || value.version !== AI_PERSISTENCE_VERSION || value.tableId !== tableId
    || !isNullableString(value.currentConversationId) || !Array.isArray(value.conversations)
    || !value.conversations.every((entry) => isIndexEntry(entry) && entry.tableId === tableId)) return null;
  return value as unknown as AIConversationIndexDocument;
}

export function parseConversationDocument(
  value: unknown,
  tableId: string,
  conversationId: string,
): AIConversationDocument | null {
  if (!isRecord(value) || value.version !== AI_PERSISTENCE_VERSION || !isConversation(value.conversation)
    || value.conversation.tableId !== tableId || value.conversation.id !== conversationId) return null;
  return value as unknown as AIConversationDocument;
}

function isProviderConfig(value: unknown): value is AIProviderConfig {
  if (!isRecord(value)) return false;
  return ["id", "name", "defaultModelId", "createdAt", "updatedAt"].every((key) => isString(value[key]))
    && isString(value.baseUrl)
    && isString(value.name)
    && isString(value.defaultModelId)
    && getAIProviderBaseUrlIssue(value.baseUrl) === undefined
    && getAIProviderNameIssue(value.name) === undefined
    && getAIProviderModelIssue(value.defaultModelId) === undefined
    && Array.isArray(value.cachedModelIds)
    && value.cachedModelIds.every(isString)
    && ["unknown", "available", "limited", "unavailable"].includes(String(value.capabilityStatus));
}

export function parseProviderDocument(value: unknown): AIProviderConfigDocument | null {
  if (!isRecord(value) || value.version !== AI_PERSISTENCE_VERSION || !Array.isArray(value.configs)
    || !value.configs.every(isProviderConfig)) return null;
  return {
    version: AI_PERSISTENCE_VERSION,
    configs: value.configs.map(normalizeProviderConfig),
  };
}

export function normalizeProviderConfig(config: AIProviderConfig): AIProviderConfig {
  return {
    id: config.id,
    name: config.name,
    baseUrl: config.baseUrl,
    defaultModelId: config.defaultModelId,
    cachedModelIds: [...config.cachedModelIds],
    capabilityStatus: config.capabilityStatus,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export function parsePanelPreferenceDocument(value: unknown): AIPanelPreferenceDocument | null {
  if (!isRecord(value) || value.version !== AI_PERSISTENCE_VERSION || !isRecord(value.preference)) return null;
  const preference = value.preference;
  if (typeof preference.open !== "boolean" || typeof preference.width !== "number" || !Number.isFinite(preference.width)
    || (preference.defaultProviderConfigId !== undefined && !isNullableString(preference.defaultProviderConfigId))
    || (preference.dataExfiltrationConfirmed !== undefined && typeof preference.dataExfiltrationConfirmed !== "boolean")
    || !isNullableString(preference.lastProviderConfigId) || !isNullableString(preference.lastModelId)) return null;
  const normalized = {
    ...preference,
    defaultProviderConfigId: preference.defaultProviderConfigId === undefined ? null : preference.defaultProviderConfigId,
    dataExfiltrationConfirmed: preference.dataExfiltrationConfirmed === true,
  };
  return {
    version: AI_PERSISTENCE_VERSION,
    preference: normalizePanelPreference(normalized as unknown as AIPanelPreference),
  };
}

export function normalizePanelPreference(preference: AIPanelPreference): AIPanelPreference {
  return {
    open: preference.open,
    width: preference.width,
    defaultProviderConfigId: preference.defaultProviderConfigId,
    dataExfiltrationConfirmed: preference.dataExfiltrationConfirmed,
    lastProviderConfigId: preference.lastProviderConfigId,
    lastModelId: preference.lastModelId,
  };
}

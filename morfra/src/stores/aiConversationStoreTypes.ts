import type { AIChatTransport } from "../lib/ai/chatOrchestrator";
import type { AIConversationTitleGenerator } from "../lib/ai/titleGenerator";
import type { TableDataAdapter } from "../lib/ai/tableDataAdapter";
import type {
  AIConversation,
  AIConversationMode,
  AIProviderConfig,
} from "../types/ai";
import type {
  deleteAIConversation,
  loadAIConversationIndex,
  loadAIConversations,
  saveAIConversation,
  clearAllAIConversationData,
  AIStorageIssue,
} from "../lib/ai/persistence";

export interface AIConversationRuntime {
  adapter: TableDataAdapter;
  providerConfig: Pick<AIProviderConfig, "id" | "baseUrl" | "defaultModelId">;
  modelId?: string;
  dataExfiltrationConfirmed: boolean;
  transport?: AIChatTransport;
  generateTitle?: AIConversationTitleGenerator;
}

export interface AIConversationPersistence {
  loadAIConversationIndex: typeof loadAIConversationIndex;
  loadAIConversations: typeof loadAIConversations;
  saveAIConversation: typeof saveAIConversation;
  deleteAIConversation: typeof deleteAIConversation;
  clearAllAIConversationData: typeof clearAllAIConversationData;
}

export interface AIConversationStoreOptions {
  persistence?: Partial<AIConversationPersistence>;
  now?: () => string;
  createId?: () => string;
}

export interface AIActiveRequest {
  requestId: string;
  assistantMessageId: string;
  acceptDeltas: boolean;
  stop: () => Promise<void>;
}

export interface AIConversationActionResult {
  ok: boolean;
  message?: string;
  requestId?: string;
}

export interface AIConversationState {
  activeTableId: string | null;
  conversationsByTable: Record<string, AIConversation[]>;
  currentConversationIdByTable: Record<string, string | null>;
  loadedTables: Record<string, boolean>;
  loadingTables: Record<string, boolean>;
  storageIssuesByTable: Record<string, AIStorageIssue[]>;
  activeRequests: Record<string, AIActiveRequest | undefined>;
  persistenceError: string | null;
  loadTable: (tableId: string) => Promise<void>;
  switchTable: (tableId: string) => Promise<void>;
  getCurrentConversation: (tableId?: string) => AIConversation | null;
  createConversation: (input: { tableId: string; mode: AIConversationMode; providerConfigId: string; modelId: string }) => Promise<AIConversation>;
  selectConversation: (tableId: string, conversationId: string) => Promise<AIConversationActionResult>;
  renameConversation: (tableId: string, conversationId: string, title: string) => Promise<AIConversationActionResult>;
  deleteConversation: (tableId: string, conversationId: string) => Promise<AIConversationActionResult>;
  setConversationModel: (tableId: string, conversationId: string, providerConfigId: string, modelId: string) => Promise<AIConversationActionResult>;
  sendMessage: (input: { tableId: string; conversationId?: string; question: string; selectionReferenced?: boolean; selectedRecordIds?: readonly string[]; runtime: AIConversationRuntime }) => Promise<AIConversationActionResult>;
  retryMessage: (input: { tableId: string; conversationId: string; assistantMessageId: string; runtime: AIConversationRuntime }) => Promise<AIConversationActionResult>;
  stopConversation: (conversationId: string) => Promise<AIConversationActionResult>;
  copyAnswer: (tableId: string, conversationId: string, assistantMessageId: string) => string;
  clearAllHistory: () => Promise<void>;
}

export function sortRecent(conversations: AIConversation[]): AIConversation[] {
  return [...conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

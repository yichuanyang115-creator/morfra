export const AI_PERSISTENCE_VERSION = 1 as const;

export type AIConversationMode = "table-analysis" | "general";
export type AIMessageRole = "user" | "assistant";
export type AIMessageStatus = "pending" | "streaming" | "complete" | "stopped" | "failed";
export type AIProviderCapabilityStatus = "unknown" | "available" | "limited" | "unavailable";

export interface AIProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  defaultModelId: string;
  cachedModelIds: string[];
  capabilityStatus: AIProviderCapabilityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AIProviderSecretRef {
  providerConfigId: string;
  keychainService: string;
  keychainAccount: string;
}

export type AIContextRef =
  | { type: "none" }
  | { type: "fullTable" }
  | { type: "selectedRecords"; recordIds: string[] };

export type AIPrimitive = string | number | boolean | null;

export interface AIMarkdownBlock {
  type: "markdown";
  markdown: string;
}

export interface AIMetricsBlock {
  type: "metrics";
  items: Array<{ label: string; value: AIPrimitive; unit?: string }>;
}

export interface AITableBlock {
  type: "table";
  columns: Array<{ id: string; label: string }>;
  rows: Array<Record<string, AIPrimitive>>;
}

export interface AIRecordRefsBlock {
  type: "recordRefs";
  records: Array<{ recordId: string; title: string }>;
}

export type AIAnswerBlock = AIMarkdownBlock | AIMetricsBlock | AITableBlock | AIRecordRefsBlock;

export interface AIMessage {
  id: string;
  conversationId: string;
  role: AIMessageRole;
  contentBlocks: AIAnswerBlock[];
  contextRef: AIContextRef | null;
  providerConfigId: string | null;
  modelId: string | null;
  status: AIMessageStatus;
  createdAt: string;
  /** 仅保存安全的可呈现错误，不保存供应商原始响应或请求正文。 */
  errorMessage?: string;
}

export interface AIConversation {
  id: string;
  tableId: string;
  mode: AIConversationMode;
  title: string;
  providerConfigId: string;
  modelId: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

export type AIAnalysisFilterOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "isEmpty"
  | "isNotEmpty"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual";

export interface AIAnalysisFilter {
  fieldId: string;
  operator: AIAnalysisFilterOperator;
  value?: AIPrimitive | AIPrimitive[];
}

export type AIAnalysisAggregateOperation = "count" | "percentage" | "sum" | "average" | "minimum" | "maximum";

export interface AIAnalysisAggregate {
  id: string;
  operation: AIAnalysisAggregateOperation;
  fieldId?: string;
}

export interface AIAnalysisPlan {
  filters: AIAnalysisFilter[];
  projections: string[];
  groupBy: string[];
  aggregates: AIAnalysisAggregate[];
  sort: Array<{ fieldId: string; direction: "ascending" | "descending" }>;
  limit: number | null;
  /** 可选的模型范围声明；宿主传入的已选记录范围始终拥有更高优先级。 */
  recordIds?: string[];
}

export interface AIPanelPreference {
  open: boolean;
  width: number;
  defaultProviderConfigId: string | null;
  dataExfiltrationConfirmed: boolean;
  lastProviderConfigId: string | null;
  lastModelId: string | null;
}

export interface AIProviderConfigDocument {
  version: typeof AI_PERSISTENCE_VERSION;
  configs: AIProviderConfig[];
}

export interface AIPanelPreferenceDocument {
  version: typeof AI_PERSISTENCE_VERSION;
  preference: AIPanelPreference;
}

export interface AIConversationIndexEntry {
  id: string;
  tableId: string;
  mode: AIConversationMode;
  title: string;
  providerConfigId: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIConversationIndexDocument {
  version: typeof AI_PERSISTENCE_VERSION;
  tableId: string;
  currentConversationId: string | null;
  conversations: AIConversationIndexEntry[];
}

export interface AIConversationDocument {
  version: typeof AI_PERSISTENCE_VERSION;
  conversation: AIConversation;
}

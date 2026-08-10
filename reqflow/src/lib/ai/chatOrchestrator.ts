import { nanoid } from "nanoid";
import type {
  AIAnswerBlock,
  AIConversationMode,
  AIContextRef,
  AIMessage,
  AIAnalysisPlan,
} from "../../types/ai";
import {
  AIProviderClientError,
  startAIChat,
  toAIProviderError,
  type AIChatCompletion,
  type AIChatHandle,
  type AIChatMessage,
  type AIChatRequest,
} from "./providerClient";
import { prepareAnalysisContext, type MinimalAnswerContext } from "./contextBuilder";
import { contextRefForRoute, routeContext, type AIContextRoute } from "./contextRouter";
import { createSafeAnalysisDeltaEmitter, safeAnalysisNarrative } from "./analysisNarrative";
import { messageText } from "./messagePersistence";
import type { TableDataAdapter, TableSnapshot } from "./tableDataAdapter";

export interface AIChatTransport {
  start(request: AIChatRequest, onDelta?: (content: string) => void): Promise<AIChatHandle>;
}

export interface ChatOrchestratorInput {
  tableId: string;
  conversationId: string;
  mode: AIConversationMode;
  question: string;
  providerConfigId: string;
  baseUrl: string;
  modelId: string;
  dataExfiltrationConfirmed: boolean;
  adapter: TableDataAdapter;
  previousMessages?: readonly AIMessage[];
  selectionReferenced?: boolean;
  selectedRecordIds?: readonly string[];
  transport?: AIChatTransport;
  maxContextRecords?: number;
  onDelta?: (content: string) => void;
}

export type AIOrchestrationStatus = "complete" | "stopped" | "failed" | "clarification";
export type AIOrchestrationErrorCode = "table-mismatch" | "model-incompatible" | "ambiguous-question" | "provider-error";

export interface AIOrchestrationResult {
  requestId: string;
  status: AIOrchestrationStatus;
  content: string;
  answerBlocks: AIAnswerBlock[];
  contextRef: AIContextRef | null;
  minimalContext?: MinimalAnswerContext;
  errorCode?: AIOrchestrationErrorCode;
  errorMessage?: string;
}

export interface AIChatOrchestratorHandle {
  requestId: string;
  completion: Promise<AIOrchestrationResult>;
  stop: () => Promise<void>;
}

export interface ResolvedChatContext {
  route: AIContextRoute;
  contextRef: AIContextRef | null;
}

export function resolveChatContext(input: {
  mode: AIConversationMode;
  question: string;
  selectionReferenced?: boolean;
  selectedRecordIds?: readonly string[];
}): ResolvedChatContext {
  const route = routeContext({
    mode: input.mode,
    message: input.question,
    selectionReferenced: input.selectionReferenced,
    selectedRecordIds: input.selectedRecordIds,
  });
  return { route, contextRef: contextRefForRoute(route) };
}

function historyMessages(messages: readonly AIMessage[] | undefined): AIChatMessage[] {
  return (messages ?? [])
    .filter((message) => message.status === "complete" || message.status === "stopped")
    .map((message) => ({ role: message.role, content: messageText(message) }));
}

function fieldSchema(snapshot: TableSnapshot): string {
  return JSON.stringify({
    tableId: snapshot.tableId,
    name: snapshot.name,
    fields: snapshot.fields.map((field) => ({ id: field.id, name: field.name, type: field.type, options: field.options })),
  });
}

function planMessages(snapshot: TableSnapshot, question: string, previous: readonly AIMessage[] | undefined, issueText = ""): AIChatMessage[] {
  return [
    { role: "system", content: "你是表格分析计划生成器。只返回一个 JSON 对象，不要 Markdown，不要统计结论。计划必须包含 filters、projections、groupBy、aggregates、sort、limit；只能使用给定字段 ID。" },
    ...historyMessages(previous),
    { role: "user", content: `问题：${question}\n表结构：${fieldSchema(snapshot)}${issueText ? `\n上次计划校验失败，请修正：${issueText}` : ""}` },
  ];
}

function answerMessages(
  question: string,
  context: MinimalAnswerContext,
  previous: readonly AIMessage[] | undefined,
): AIChatMessage[] {
  return [
    { role: "system", content: "你是表格回答助手。只能使用 LOCAL_ANALYSIS_CONTEXT 中的本地校验结果回答。Markdown 叙述不得输出精确数字、范围、字段值或记录名称；这些由本地结构化结果呈现。不得自行计算或补造表内事实，直接数据、确定性计算和推断要区分。" },
    ...historyMessages(previous),
    { role: "user", content: `问题：${question}\nLOCAL_ANALYSIS_CONTEXT：${JSON.stringify(context)}` },
  ];
}

function plainAnswerMessages(question: string, previous: readonly AIMessage[] | undefined): AIChatMessage[] {
  return [
    { role: "system", content: "你是通用对话助手。不要把任何未提供的内容说成当前表事实。" },
    ...historyMessages(previous),
    { role: "user", content: question },
  ];
}

function parsePlan(content: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/iu.exec(content)?.[1]?.trim();
  const candidate = fenced ?? content.trim();
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

function restrictPlanToUserScope(candidate: unknown, route: AIContextRoute): unknown {
  if (route.type === "selectedRecords" || typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return candidate;
  return Object.fromEntries(Object.entries(candidate).filter(([key]) => key !== "recordIds"));
}

function primitive(value: unknown): string | number | boolean | null {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return value === undefined ? null : JSON.stringify(value);
}

function answerBlocks(markdown: string, context?: MinimalAnswerContext): AIAnswerBlock[] {
  if (!context) return [{ type: "markdown", markdown }];
  const blocks: AIAnswerBlock[] = [{ type: "markdown", markdown: safeAnalysisNarrative(markdown) }];
  const metrics = context.analysis.aggregates.map((aggregate) => ({ label: aggregate.id, value: primitive(aggregate.value) }));
  if (metrics.length > 0) blocks.push({ type: "metrics", items: metrics });
  if (context.analysis.rows.length > 0) {
    const fields = context.fields.filter((field) => context.analysis.rows.some((row) => field.id in row.values));
    blocks.push({
      type: "table",
      columns: fields.map((field) => ({ id: field.id, label: field.name })),
      rows: context.analysis.rows.map((row) => Object.fromEntries(fields.map((field) => [field.id, primitive(row.values[field.id])]))),
    });
  }
  if (context.records.length > 0) {
    blocks.push({ type: "recordRefs", records: context.records.map((record) => ({ recordId: record.recordId, title: record.title })) });
  }
  return blocks;
}

function providerFailure(error: unknown, requestId: string, contextRef: AIContextRef | null): AIOrchestrationResult {
  const normalized = error instanceof AIProviderClientError ? error : toAIProviderError(error);
  return {
    requestId,
    status: "failed",
    content: "",
    answerBlocks: [],
    contextRef,
    errorCode: "provider-error",
    errorMessage: normalized.message,
  };
}

export function startChatOrchestration(input: ChatOrchestratorInput): AIChatOrchestratorHandle {
  const requestId = nanoid();
  const transport = input.transport ?? { start: startAIChat } satisfies AIChatTransport;
  let activeHandle: AIChatHandle | null = null;
  let stopped = false;

  const runProvider = async (messages: AIChatMessage[], childRequestId: string, onDelta?: (content: string) => void): Promise<AIChatCompletion> => {
    if (stopped) return { requestId: childRequestId, content: "", streamed: true, status: "stopped" };
    const handle = await transport.start({
      requestId: childRequestId,
      providerConfigId: input.providerConfigId,
      baseUrl: input.baseUrl,
      modelId: input.modelId,
      messages,
      dataExfiltrationConfirmed: input.dataExfiltrationConfirmed,
    }, onDelta);
    activeHandle = handle;
    if (stopped) await handle.cancel();
    const completion = await handle.completion;
    activeHandle = null;
    return completion;
  };

  const completion = (async (): Promise<AIOrchestrationResult> => {
    const resolved = resolveChatContext(input);
    const activeTable = input.adapter.getActiveTable();
    if (activeTable && activeTable.tableId !== input.tableId) {
      return { requestId, status: "failed", content: "", answerBlocks: [], contextRef: resolved.contextRef, errorCode: "table-mismatch", errorMessage: "当前表已切换，请重新选择会话" };
    }
    if (resolved.route.type === "clarification") {
      return { requestId, status: "clarification", content: "这个问题可能需要结合当前表。请明确要分析当前表，还是只进行通用对话。", answerBlocks: [{ type: "markdown", markdown: "这个问题可能需要结合当前表。请明确要分析当前表，还是只进行通用对话。" }], contextRef: null, errorCode: "ambiguous-question" };
    }
    if (resolved.route.type === "none") {
      try {
        const result = await runProvider(plainAnswerMessages(input.question, input.previousMessages), `${requestId}-answer`, input.onDelta);
        return { requestId, status: result.status, content: result.content, answerBlocks: [{ type: "markdown", markdown: result.content }], contextRef: { type: "none" } };
      } catch (error) {
        return providerFailure(error, requestId, { type: "none" });
      }
    }

    let snapshot: TableSnapshot;
    try {
      snapshot = await input.adapter.getTableSnapshot(input.tableId);
    } catch (error) {
      return providerFailure(error, requestId, resolved.contextRef);
    }
    let prepared: ReturnType<typeof prepareAnalysisContext> | null = null;
    let issueText = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const planCompletion = await runProvider(planMessages(snapshot, input.question, input.previousMessages, issueText), `${requestId}-plan-${attempt + 1}`);
        if (planCompletion.status === "stopped") return { requestId, status: "stopped", content: "", answerBlocks: [], contextRef: resolved.contextRef };
        const candidate = parsePlan(planCompletion.content) as AIAnalysisPlan | null;
        prepared = prepareAnalysisContext(snapshot, restrictPlanToUserScope(candidate, resolved.route), {
          recordIds: resolved.route.type === "selectedRecords" ? resolved.route.recordIds : undefined,
          maxContextRecords: input.maxContextRecords,
        });
        if (prepared.ok) break;
        issueText = prepared.issues.map((issue) => `${issue.path}: ${issue.message}`).join("；");
      } catch (error) {
        return providerFailure(error, requestId, resolved.contextRef);
      }
    }
    if (!prepared?.ok) {
      return { requestId, status: "failed", content: "", answerBlocks: [], contextRef: resolved.contextRef, errorCode: "model-incompatible", errorMessage: "模型无法生成可执行的表格分析计划" };
    }
    try {
      // 模型流只推进本地安全状态，精确结果继续只来自本地结构化块。
      const narrative = createSafeAnalysisDeltaEmitter(input.onDelta);
      const answer = await runProvider(answerMessages(input.question, prepared.context, input.previousMessages), `${requestId}-answer`, narrative.push);
      if (answer.status === "stopped") narrative.flush(answer.content);
      const safeContent = safeAnalysisNarrative(answer.content);
      return {
        requestId,
        status: answer.status,
        content: safeContent,
        answerBlocks: answerBlocks(safeContent, prepared.context),
        contextRef: resolved.contextRef,
        minimalContext: prepared.context,
      };
    } catch (error) {
      return providerFailure(error, requestId, resolved.contextRef);
    }
  })();

  return {
    requestId,
    completion,
    stop: async () => {
      stopped = true;
      await activeHandle?.cancel();
    },
  };
}

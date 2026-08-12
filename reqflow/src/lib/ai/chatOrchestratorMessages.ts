import type { AIAnswerBlock, AIContextRef, AIMessage, AIAnalysisPlan } from "../../types/ai";
import { AIProviderClientError, toAIProviderError, type AIChatMessage } from "./providerClient";
import { safeAnalysisNarrative } from "./analysisNarrative";
import { messageText } from "./messagePersistence";
import type { AIContextRoute } from "./contextRouter";
import type { MinimalAnswerContext } from "./contextBuilder";
import type { AIOrchestrationResult } from "./chatOrchestrator";
import type { TableSnapshot } from "./tableDataAdapter";

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

export function planMessages(snapshot: TableSnapshot, question: string, previous: readonly AIMessage[] | undefined, issueText = ""): AIChatMessage[] {
  return [
    { role: "system", content: "你是表格分析计划生成器。只返回一个 JSON 对象，不要 Markdown，不要统计结论。计划必须包含 filters、projections、groupBy、aggregates、sort、limit；只能使用给定字段 ID。" },
    ...historyMessages(previous),
    { role: "user", content: `问题：${question}\n表结构：${fieldSchema(snapshot)}${issueText ? `\n上次计划校验失败，请修正：${issueText}` : ""}` },
  ];
}

export function answerMessages(question: string, context: MinimalAnswerContext, previous: readonly AIMessage[] | undefined): AIChatMessage[] {
  return [
    { role: "system", content: "你是表格回答助手。只能使用 LOCAL_ANALYSIS_CONTEXT 中的本地校验结果回答。Markdown 叙述不得输出精确数字、范围、字段值或记录名称；这些由本地结构化结果呈现。不得自行计算或补造表内事实，直接数据、确定性计算和推断要区分。" },
    ...historyMessages(previous),
    { role: "user", content: `问题：${question}\nLOCAL_ANALYSIS_CONTEXT：${JSON.stringify(context)}` },
  ];
}

export function plainAnswerMessages(question: string, previous: readonly AIMessage[] | undefined): AIChatMessage[] {
  return [
    { role: "system", content: "你是通用对话助手。不要把任何未提供的内容说成当前表事实。" },
    ...historyMessages(previous),
    { role: "user", content: question },
  ];
}

export function parsePlan(content: string): unknown {
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

export function restrictPlanToUserScope(candidate: unknown, route: AIContextRoute): AIAnalysisPlan | null {
  if (route.type === "selectedRecords" || typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return candidate as AIAnalysisPlan | null;
  return Object.fromEntries(Object.entries(candidate).filter(([key]) => key !== "recordIds")) as unknown as AIAnalysisPlan;
}

function primitive(value: unknown): string | number | boolean | null {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return value === undefined ? null : JSON.stringify(value);
}

export function buildAnswerBlocks(markdown: string, context?: MinimalAnswerContext): AIAnswerBlock[] {
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
  if (context.records.length > 0) blocks.push({ type: "recordRefs", records: context.records.map((record) => ({ recordId: record.recordId, title: record.title })) });
  return blocks;
}

export function providerFailure(error: unknown, requestId: string, contextRef: AIContextRef | null): AIOrchestrationResult {
  const normalized = error instanceof AIProviderClientError ? error : toAIProviderError(error);
  return { requestId, status: "failed", content: "", answerBlocks: [], contextRef, errorCode: "provider-error", errorMessage: normalized.message };
}

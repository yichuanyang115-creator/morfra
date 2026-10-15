import { nanoid } from "nanoid";
import type { AIAnswerBlock, AIConversationMode, AIContextRef, AIMessage, AIAnalysisPlan } from "../../types/ai";
import {
  AIProviderClientError,
  startAIChat,
  type AIChatCompletion,
  type AIChatHandle,
  type AIChatMessage,
  type AIChatRequest,
} from "./providerClient";
import { prepareAnalysisContext, type MinimalAnswerContext } from "./contextBuilder";
import { contextRefForRoute, routeContext, type AIContextRoute } from "./contextRouter";
import { createSafeAnalysisDeltaEmitter, safeAnalysisNarrative } from "./analysisNarrative";
import { answerMessages, buildAnswerBlocks, parsePlan, plainAnswerMessages, planMessages, providerFailure, restrictPlanToUserScope } from "./chatOrchestratorMessages";
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
  providerStageTimeoutMs?: number;
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

const DEFAULT_PROVIDER_STAGE_TIMEOUT_MS = 60_000;

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


export function startChatOrchestration(input: ChatOrchestratorInput): AIChatOrchestratorHandle {
  const requestId = nanoid();
  const transport = input.transport ?? { start: startAIChat } satisfies AIChatTransport;
  let activeHandle: AIChatHandle | null = null;
  let stopped = false;
  let resolveStopped: (() => void) | undefined;
  const stoppedSignal = new Promise<void>((resolve) => { resolveStopped = resolve; });
  const cancelInBackground = (target: AIChatHandle | null) => {
    if (!target) return;
    if (activeHandle === target) activeHandle = null;
    void target.cancel().catch(() => undefined);
  };

  const runProvider = async (messages: AIChatMessage[], childRequestId: string, onDelta?: (content: string) => void): Promise<AIChatCompletion> => {
    if (stopped) return { requestId: childRequestId, content: "", streamed: true, status: "stopped" };
    const timeoutMs = Math.max(1, input.providerStageTimeoutMs ?? DEFAULT_PROVIDER_STAGE_TIMEOUT_MS);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let handle: AIChatHandle | null = null;
    let stageClosed = false;
    const providerStage = (async (): Promise<AIChatCompletion> => {
      const started = await transport.start({
        requestId: childRequestId,
        providerConfigId: input.providerConfigId,
        baseUrl: input.baseUrl,
        modelId: input.modelId,
        messages,
        dataExfiltrationConfirmed: input.dataExfiltrationConfirmed,
      }, (content) => {
        if (!stageClosed && !stopped) onDelta?.(content);
      });
      handle = started;
      if (stageClosed || stopped) {
        cancelInBackground(started);
        return { requestId: childRequestId, content: "", streamed: true, status: "stopped" };
      }
      activeHandle = started;
      return started.completion;
    })();
    try {
      return await Promise.race([
        providerStage,
        stoppedSignal.then((): AIChatCompletion => ({ requestId: childRequestId, content: "", streamed: true, status: "stopped" })),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            stageClosed = true;
            cancelInBackground(handle);
            reject(new AIProviderClientError({ code: "network_unavailable", message: "AI 服务响应超时，请重试或更换模型。", retryable: true }));
          }, timeoutMs);
        }),
      ]);
    } finally {
      stageClosed = true;
      if (timer !== undefined) clearTimeout(timer);
      if (activeHandle === handle) activeHandle = null;
    }
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
        answerBlocks: buildAnswerBlocks(safeContent, prepared.context),
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
      if (stopped) return;
      stopped = true;
      resolveStopped?.();
      cancelInBackground(activeHandle);
    },
  };
}

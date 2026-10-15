import { Channel, invoke } from "@tauri-apps/api/core";
import { nanoid } from "nanoid";

export type AIProviderErrorCode =
  | "invalid_provider_config" | "invalid_base_url" | "invalid_model" | "invalid_request"
  | "missing_api_key" | "keychain_unavailable" | "unauthorized" | "models_unavailable"
  | "model_not_found" | "rate_limited" | "network_unavailable" | "provider_error"
  | "invalid_response" | "stream_interrupted" | "request_cancelled" | "request_in_progress"
  | "data_exfiltration_not_confirmed" | "payload_too_large";

export interface AIProviderError {
  code: AIProviderErrorCode;
  message: string;
  retryable: boolean;
}

export class AIProviderClientError extends Error {
  readonly code: AIProviderErrorCode;
  readonly retryable: boolean;

  constructor(error: AIProviderError) {
    super(error.message);
    this.name = "AIProviderClientError";
    this.code = error.code;
    this.retryable = error.retryable;
  }
}

export interface AIModelListResult {
  modelIds: string[];
  source: "remote";
}

export type AICapabilitySupport = "supported" | "unsupported" | "unknown";

export interface AICapabilityProbe {
  modelId: string;
  chatAvailable: boolean;
  models: AICapabilitySupport;
  streaming: AICapabilitySupport;
  structuredOutput: AICapabilitySupport;
  toolCalls: AICapabilitySupport;
}

export type AIChatRole = "system" | "user" | "assistant";

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
}

export interface AIChatRequest {
  requestId?: string;
  providerConfigId: string;
  baseUrl: string;
  modelId: string;
  messages: AIChatMessage[];
  dataExfiltrationConfirmed: boolean;
}

export interface AIChatCompletion {
  requestId: string;
  content: string;
  streamed: boolean;
  status: "complete" | "stopped";
}

interface AIRequestHandleResponse {
  requestId: string;
}

interface AIStreamDeltaEvent {
  type: "delta";
  requestId: string;
  content: string;
}

interface AIStreamCompleteEvent {
  type: "complete";
  requestId: string;
  content: string;
  streamed: boolean;
}

interface AIStreamErrorEvent {
  type: "error";
  requestId: string;
  error: AIProviderError;
}

export type AIChatStreamEvent = AIStreamDeltaEvent | AIStreamCompleteEvent | AIStreamErrorEvent;

export interface AIChatHandle {
  requestId: string;
  completion: Promise<AIChatCompletion>;
  cancel: () => Promise<void>;
}

const activeCancelRequests = new Map<string, () => Promise<void>>();

const SAFE_MESSAGES: Record<AIProviderErrorCode, string> = {
  invalid_provider_config: "AI 服务配置标识无效",
  invalid_base_url: "Base URL 无效或不是 HTTPS 地址",
  invalid_model: "模型 ID 无效",
  invalid_request: "请求内容无效，请检查后重试",
  missing_api_key: "请先配置 API Key",
  keychain_unavailable: "系统密钥存储不可用，请检查 macOS Keychain 后重试",
  unauthorized: "API Key 无效或没有访问权限，请检查服务配置",
  models_unavailable: "该服务不提供可用的模型列表，请手填模型 ID 后单独测试",
  model_not_found: "模型不存在或当前服务不支持该模型，请检查模型 ID",
  rate_limited: "AI 服务当前限流，请稍后重试",
  network_unavailable: "无法连接 AI 服务，请检查网络或地址后重试",
  provider_error: "AI 服务拒绝了请求，请检查配置或请求格式",
  invalid_response: "AI 服务返回了无法解析的响应",
  stream_interrupted: "AI 流式连接意外中断，请重试",
  request_cancelled: "请求已停止",
  request_in_progress: "同一请求正在生成中",
  data_exfiltration_not_confirmed: "请先确认数据外传说明，再测试或发送请求",
  payload_too_large: "请求或响应内容过大，请缩短内容后重试",
};

const ERROR_CODES = new Set<AIProviderErrorCode>(Object.keys(SAFE_MESSAGES) as AIProviderErrorCode[]);

export function toAIProviderError(value: unknown): AIProviderError {
  const candidate = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const code = typeof candidate.code === "string" && ERROR_CODES.has(candidate.code as AIProviderErrorCode)
    ? candidate.code as AIProviderErrorCode
    : "provider_error";
  return { code, message: SAFE_MESSAGES[code], retryable: candidate.retryable === true };
}

function throwProviderError(value: unknown): never {
  throw new AIProviderClientError(toAIProviderError(value));
}

export async function listAIModels(input: { providerConfigId: string; baseUrl: string; dataExfiltrationConfirmed: boolean }): Promise<AIModelListResult> {
  try {
    return await invoke<AIModelListResult>("list_ai_models", input);
  } catch (error) {
    return throwProviderError(error);
  }
}

export async function testAIProvider(input: { providerConfigId: string; baseUrl: string; modelId: string; dataExfiltrationConfirmed: boolean }): Promise<AICapabilityProbe> {
  try {
    return await invoke<AICapabilityProbe>("test_ai_provider", input);
  } catch (error) {
    return throwProviderError(error);
  }
}

export async function startAIChat(
  request: AIChatRequest,
  onDelta?: (content: string) => void,
): Promise<AIChatHandle> {
  const requestId = request.requestId ?? nanoid();
  let accumulated = "";
  let settled = false;
  let cancelled = false;
  let resolveCompletion: (completion: AIChatCompletion) => void = () => undefined;
  let rejectCompletion: (error: AIProviderClientError) => void = () => undefined;
  const completion = new Promise<AIChatCompletion>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  const channel = new Channel<AIChatStreamEvent>((event) => {
    if (settled || cancelled || event.requestId !== requestId) return;
    if (event.type === "delta") {
      accumulated += event.content;
      onDelta?.(event.content);
      return;
    }
    if (event.type === "complete") {
      settled = true;
      activeCancelRequests.delete(requestId);
      resolveCompletion({ requestId, content: event.content || accumulated, streamed: event.streamed, status: "complete" });
      return;
    }
    settled = true;
    activeCancelRequests.delete(requestId);
    rejectCompletion(new AIProviderClientError(event.error));
  });
  let cancelPromise: Promise<void> | null = null;
  const cancel = async () => {
    if (cancelPromise) return cancelPromise;
    cancelPromise = (async () => {
      if (settled || cancelled) return;
      cancelled = true;
      try {
        await invoke<void>("cancel_ai_chat", { requestId });
      } catch (error) {
        cancelled = false;
        cancelPromise = null;
        return throwProviderError(error);
      }
      settled = true;
      activeCancelRequests.delete(requestId);
      resolveCompletion({ requestId, content: accumulated, streamed: true, status: "stopped" });
    })();
    return cancelPromise;
  };
  activeCancelRequests.set(requestId, cancel);
  try {
    await invoke<AIRequestHandleResponse>("start_ai_chat", {
      request: { ...request, requestId },
      channel,
    });
  } catch (error) {
    settled = true;
    activeCancelRequests.delete(requestId);
    const normalized = toAIProviderError(error);
    rejectCompletion(new AIProviderClientError(normalized));
    return throwProviderError(normalized);
  }
  return { requestId, completion, cancel };
}

export const streamAIChat = startAIChat;

export async function cancelAIChat(requestId: string): Promise<void> {
  const activeCancel = activeCancelRequests.get(requestId);
  if (activeCancel) return activeCancel();
  try {
    await invoke<void>("cancel_ai_chat", { requestId });
  } catch (error) {
    return throwProviderError(error);
  }
}

import type { AIChatHandle, AIChatMessage } from "./providerClient";

export const AI_CONVERSATION_DEFAULT_TITLES = {
  "table-analysis": "表格分析",
  general: "通用对话",
} as const;

const TITLE_MAX_LENGTH = 40;

export type AIConversationTitleGenerator = (question: string) => Promise<string>;

export function fallbackConversationTitle(question: string, maxLength = TITLE_MAX_LENGTH): string {
  const normalized = question.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`;
}

function normalizeGeneratedTitle(value: string): string {
  return value
    .replace(/^['"“”「」]+|['"“”「」]+$/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** 标题是增强能力；任何模型失败都必须静默退回首条问题，不能影响主回答。 */
export async function generateConversationTitle(
  question: string,
  generator?: AIConversationTitleGenerator,
): Promise<string> {
  const fallback = fallbackConversationTitle(question);
  if (!generator) return fallback;
  try {
    const generated = normalizeGeneratedTitle(await generator(question));
    return generated.length > 0 ? fallbackConversationTitle(generated) : fallback;
  } catch {
    return fallback;
  }
}

export interface AIConversationTitleRequest {
  providerConfigId: string;
  baseUrl: string;
  modelId: string;
  dataExfiltrationConfirmed: boolean;
  start: (
    request: {
      requestId: string;
      providerConfigId: string;
      baseUrl: string;
      modelId: string;
      messages: AIChatMessage[];
      dataExfiltrationConfirmed: boolean;
    },
    onDelta?: (content: string) => void,
  ) => Promise<AIChatHandle>;
}

export async function generateConversationTitleWithModel(
  question: string,
  input: AIConversationTitleRequest,
): Promise<string> {
  const handle = await input.start({
    requestId: `title-${Date.now()}`,
    providerConfigId: input.providerConfigId,
    baseUrl: input.baseUrl,
    modelId: input.modelId,
    dataExfiltrationConfirmed: input.dataExfiltrationConfirmed,
    messages: [
      { role: "system", content: "请将用户问题压缩为一个不超过 12 个汉字的会话标题，只返回标题本身。" },
      { role: "user", content: question },
    ],
  });
  const completion = await handle.completion;
  return completion.content;
}

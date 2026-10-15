import { toAIProviderError, type AIProviderErrorCode } from "../lib/ai/providerClient";
import type { AIPanelPreference } from "../types/ai";
import type { AIProviderActionResult, AIProviderState } from "./aiProviderStore";

export const DEFAULT_PREFERENCE: AIPanelPreference = {
  open: false,
  width: 360,
  defaultProviderConfigId: null,
  dataExfiltrationConfirmed: false,
  lastProviderConfigId: null,
  lastModelId: null,
};

export function preferenceFromState(state: AIProviderState, overrides: Partial<AIPanelPreference> = {}): AIPanelPreference {
  return {
    open: state.panelOpen,
    width: state.panelWidth,
    defaultProviderConfigId: state.defaultProviderConfigId,
    dataExfiltrationConfirmed: state.dataExfiltrationConfirmed,
    lastProviderConfigId: state.lastProviderConfigId,
    lastModelId: state.lastModelId,
    ...overrides,
  };
}

export function actionError(): AIProviderActionResult {
  return { ok: false, message: "AI 服务保存失败，请重试" };
}

export function providerErrorAction(error: unknown): AIProviderActionResult {
  const normalized = toAIProviderError(error);
  return { ok: false, code: normalized.code as AIProviderErrorCode, message: normalized.message };
}

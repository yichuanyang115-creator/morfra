import { nanoid } from "nanoid";
import {
  deleteAIProviderSecret,
  setAIProviderSecret,
} from "../lib/ai/keychainClient";
import { getAIProviderModelIssue, validateAIProviderDraft } from "../lib/ai/aiProviderValidation";
import { saveAIProviderConfigs } from "../lib/ai/persistence";
import {
  listAIModels,
  startAIChat,
  testAIProvider,
  toAIProviderError,
} from "../lib/ai/providerClient";
import type { AICapabilityProbe } from "../lib/ai/providerClient";
import type { AIProviderConfig } from "../types/ai";
import type { AIProviderState, AIProviderStoreGet, AIProviderStoreSet } from "./aiProviderStore";
import { actionError, providerErrorAction } from "./aiProviderStoreHelpers";

export function createProviderActions(
  set: AIProviderStoreSet,
  get: AIProviderStoreGet,
): Pick<AIProviderState, "loadModelsForDraft" | "loadModels" | "setManualModel" | "testProvider" | "startChat" | "cancelChat"> {
  return {
  loadModelsForDraft: async (draft) => {
    const existing = draft.id ? get().configs.find((config) => config.id === draft.id) : undefined;
    const validation = validateAIProviderDraft(
      { ...draft, defaultModelId: draft.defaultModelId.trim() },
      existing ? get().secretStatus[existing.id] === true : false,
      { requireModel: false },
    );
    if (!validation.valid) return { ok: false, issues: validation.issues, message: "请先修正服务地址和密钥" };
    if (!get().dataExfiltrationConfirmed) return { ok: false, code: "data_exfiltration_not_confirmed", message: "请先确认数据外传说明，再加载模型" };

    const configId = validation.value.id ?? nanoid();
    const probeSecret = validation.value.secret;
    const probeConfigId = probeSecret ? `${configId}-models-${nanoid(8)}` : configId;
    set({ busy: true, errorMessage: "" });
    let stagedSecret = false;
    try {
      if (probeSecret) {
        await setAIProviderSecret(probeConfigId, probeSecret);
        stagedSecret = true;
      }
      const result = await listAIModels({ providerConfigId: probeConfigId, baseUrl: validation.value.baseUrl, dataExfiltrationConfirmed: true });
      if (stagedSecret) {
        await deleteAIProviderSecret(probeConfigId);
        stagedSecret = false;
      }
      if (validation.value.id) {
        set({
          modelIds: { ...get().modelIds, [validation.value.id]: result.modelIds },
          modelLoadStatus: { ...get().modelLoadStatus, [validation.value.id]: "loaded" },
          modelLoadErrors: { ...get().modelLoadErrors, [validation.value.id]: "" },
        });
      }
      set({ busy: false });
      return { ok: true, modelIds: result.modelIds };
    } catch (error) {
      if (stagedSecret) await deleteAIProviderSecret(probeConfigId).catch(() => undefined);
      const normalized = toAIProviderError(error);
      set({ busy: false, errorMessage: normalized.message });
      return providerErrorAction(error);
    }
  },
  loadModels: async (providerConfigId) => {
    const config = get().configs.find((item) => item.id === providerConfigId);
    if (!config) return actionError();
    if (!get().dataExfiltrationConfirmed) return { ok: false, code: "data_exfiltration_not_confirmed", message: "请先确认数据外传说明，再测试或发送请求" };
    set({ modelLoadStatus: { ...get().modelLoadStatus, [providerConfigId]: "loading" }, modelLoadErrors: { ...get().modelLoadErrors, [providerConfigId]: "" } });
    try {
      const result = await listAIModels({ providerConfigId, baseUrl: config.baseUrl, dataExfiltrationConfirmed: true });
      const configs = get().configs.map((item) => item.id === providerConfigId ? { ...item, cachedModelIds: result.modelIds, updatedAt: new Date().toISOString() } : item);
      await saveAIProviderConfigs(configs);
      const previousCapability = get().capabilities[providerConfigId];
      const capability: AICapabilityProbe = previousCapability
        ? { ...previousCapability, models: "supported" }
        : { modelId: config.defaultModelId, chatAvailable: false, models: "supported", streaming: "unknown", structuredOutput: "unknown", toolCalls: "unknown" };
      set({ configs, modelIds: { ...get().modelIds, [providerConfigId]: result.modelIds }, capabilities: { ...get().capabilities, [providerConfigId]: capability }, modelLoadStatus: { ...get().modelLoadStatus, [providerConfigId]: "loaded" } });
      return { ok: true };
    } catch (error) {
      const normalized = toAIProviderError(error);
      const previousCapability = get().capabilities[providerConfigId];
      const modelSupport = normalized.code === "models_unavailable"
        ? "unsupported"
        : previousCapability?.models ?? "unknown";
      const capability: AICapabilityProbe = previousCapability
        ? { ...previousCapability, models: modelSupport }
        : { modelId: config.defaultModelId, chatAvailable: false, models: modelSupport, streaming: "unknown", structuredOutput: "unknown", toolCalls: "unknown" };
      set({ capabilities: { ...get().capabilities, [providerConfigId]: capability }, modelLoadStatus: { ...get().modelLoadStatus, [providerConfigId]: "failed" }, modelLoadErrors: { ...get().modelLoadErrors, [providerConfigId]: normalized.message } });
      return providerErrorAction(error);
    }
  },
  setManualModel: async (providerConfigId, modelId) => {
    const config = get().configs.find((item) => item.id === providerConfigId);
    if (!config) return actionError();
    const normalizedModelId = modelId.trim();
    const issue = getAIProviderModelIssue(normalizedModelId);
    if (issue) return { ok: false, issues: { defaultModelId: issue }, message: "请修正模型 ID 后再测试" };
    const configs = get().configs.map((item) => item.id === providerConfigId ? { ...item, defaultModelId: normalizedModelId, updatedAt: new Date().toISOString() } : item);
    try {
      await saveAIProviderConfigs(configs);
      set({ configs, lastProviderConfigId: providerConfigId, lastModelId: normalizedModelId });
      return { ok: true };
    } catch {
      return actionError();
    }
  },
  testProvider: async (providerConfigId, modelId) => {
    const config = get().configs.find((item) => item.id === providerConfigId);
    if (!config) return actionError();
    if (!get().dataExfiltrationConfirmed) return { ok: false, code: "data_exfiltration_not_confirmed", message: "请先确认数据外传说明，再测试或发送请求" };
    if (!get().secretStatus[providerConfigId]) return { ok: false, code: "missing_api_key", message: "请先配置 API Key" };
    const selectedModelId = modelId?.trim() || config.defaultModelId;
    set({ connectionStatus: { ...get().connectionStatus, [providerConfigId]: "testing" }, errorMessage: "" });
    try {
      const capability = await testAIProvider({ providerConfigId, baseUrl: config.baseUrl, modelId: selectedModelId, dataExfiltrationConfirmed: true });
      const capabilityStatus: AIProviderConfig["capabilityStatus"] = capability.chatAvailable ? capability.streaming === "supported" ? "available" : "limited" : "unavailable";
      const configs = get().configs.map((item) => item.id === providerConfigId ? { ...item, defaultModelId: selectedModelId, capabilityStatus, updatedAt: new Date().toISOString() } : item);
      await saveAIProviderConfigs(configs);
      set({ configs, capabilities: { ...get().capabilities, [providerConfigId]: capability }, connectionStatus: { ...get().connectionStatus, [providerConfigId]: "available" }, lastProviderConfigId: providerConfigId, lastModelId: selectedModelId });
      return { ok: true };
    } catch (error) {
      const normalized = toAIProviderError(error);
      const configs: AIProviderConfig[] = get().configs.map((item) => item.id === providerConfigId ? { ...item, capabilityStatus: "unavailable", updatedAt: new Date().toISOString() } : item);
      set({ configs, connectionStatus: { ...get().connectionStatus, [providerConfigId]: "failed" }, errorMessage: normalized.message });
      return providerErrorAction(error);
    }
  },
  startChat: async ({ providerConfigId, modelId, messages, onDelta }) => {
    const config = get().configs.find((item) => item.id === providerConfigId);
    if (!config) return { ok: false, message: "AI 服务配置不存在", code: "invalid_provider_config" };
    if (!get().dataExfiltrationConfirmed) return { ok: false, message: "请先确认数据外传说明，再测试或发送请求", code: "data_exfiltration_not_confirmed" };
    if (!get().secretStatus[providerConfigId]) return { ok: false, message: "请先配置 API Key", code: "missing_api_key" };
    if (get().chatStatus === "streaming") return { ok: false, message: "同一请求正在生成中", code: "request_in_progress" };
    const selectedModelId = modelId?.trim() || config.defaultModelId;
    set({ chatStatus: "streaming", chatContent: "", chatError: "", activeChatHandle: null, chatCancelRequested: false });
    try {
      const handle = await startAIChat({ providerConfigId, baseUrl: config.baseUrl, modelId: selectedModelId, messages, dataExfiltrationConfirmed: true }, (content) => {
        if (get().chatCancelRequested) return;
        set({ chatContent: get().chatContent + content });
        onDelta?.(content);
      });
      set({ activeChatHandle: handle });
      if (get().chatCancelRequested) await handle.cancel();
      const completion = await handle.completion;
      set({ chatStatus: completion.status === "stopped" ? "stopped" : "complete", chatContent: completion.content, activeChatHandle: null, chatCancelRequested: false });
      return { ok: true, content: completion.content };
    } catch (error) {
      const normalized = toAIProviderError(error);
      set({ chatStatus: "failed", chatError: normalized.message, errorMessage: normalized.message, activeChatHandle: null, chatCancelRequested: false });
      return { ok: false, message: normalized.message, code: normalized.code };
    }
  },
  cancelChat: async () => {
    const handle = get().activeChatHandle;
    if (get().chatStatus !== "streaming") return { ok: true };
    if (!handle) {
      set({ chatCancelRequested: true });
      return { ok: true };
    }
    try {
      await handle.cancel();
      set({ chatStatus: "stopped", activeChatHandle: null, chatCancelRequested: false });
      return { ok: true };
    } catch (error) {
      return providerErrorAction(error);
    }
  },
  };
}

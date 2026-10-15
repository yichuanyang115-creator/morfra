import { nanoid } from "nanoid";
import {
  deleteAIProviderSecret,
  setAIProviderSecret,
} from "../lib/ai/keychainClient";
import { validateAIProviderDraft } from "../lib/ai/aiProviderValidation";
import { saveAIPanelPreference, saveAIProviderConfigs } from "../lib/ai/persistence";
import { testAIProvider, toAIProviderError } from "../lib/ai/providerClient";
import type { AIProviderConfig } from "../types/ai";
import type { AIProviderState, AIProviderStoreGet, AIProviderStoreSet } from "./aiProviderStore";
import {
  actionError,
  preferenceFromState,
  providerErrorAction,
} from "./aiProviderStoreHelpers";

export function createPersistenceActions(
  set: AIProviderStoreSet,
  get: AIProviderStoreGet,
): Pick<AIProviderState, "saveProvider" | "saveProviderAfterConnectionTest" | "deleteProvider"> {
  return {
  saveProvider: async (draft) => {
    const existing = draft.id ? get().configs.find((config) => config.id === draft.id) : undefined;
    const validation = validateAIProviderDraft(draft, existing ? get().secretStatus[existing.id] === true : false);
    if (!validation.valid) return { ok: false, issues: validation.issues, message: "请修正配置后再保存" };

    const now = new Date().toISOString();
    const config: AIProviderConfig = {
      id: validation.value.id ?? nanoid(),
      name: validation.value.name,
      baseUrl: validation.value.baseUrl,
      defaultModelId: validation.value.defaultModelId,
      cachedModelIds: existing?.cachedModelIds ?? [],
      capabilityStatus: existing?.capabilityStatus ?? "unknown",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const previousConfigs = get().configs;
    const previousPreference = preferenceFromState(get());
    const nextConfigs = existing
      ? previousConfigs.map((item) => item.id === config.id ? config : item)
      : [...previousConfigs, config];
    const nextDefaultProviderConfigId = get().defaultProviderConfigId ?? config.id;
    const nextLastProviderConfigId = existing
      ? get().lastProviderConfigId
      : get().lastProviderConfigId ?? nextDefaultProviderConfigId;
    const shouldRefreshLastModel = !existing || get().defaultProviderConfigId === config.id;
    const nextLastModelId = shouldRefreshLastModel && nextLastProviderConfigId === config.id
      ? config.defaultModelId
      : get().lastModelId;
    set({ busy: true, errorMessage: "" });

    try {
      await saveAIProviderConfigs(nextConfigs);
      await saveAIPanelPreference(preferenceFromState(get(), {
        defaultProviderConfigId: nextDefaultProviderConfigId,
        lastProviderConfigId: nextLastProviderConfigId,
        lastModelId: nextLastModelId,
      }));
      if (validation.value.secret) await setAIProviderSecret(config.id, validation.value.secret);
      set({
        configs: nextConfigs,
        defaultProviderConfigId: nextDefaultProviderConfigId,
        lastProviderConfigId: nextLastProviderConfigId,
        lastModelId: nextLastModelId,
        secretStatus: validation.value.secret
          ? { ...get().secretStatus, [config.id]: true }
          : get().secretStatus,
        busy: false,
      });
      return { ok: true, configId: config.id };
    } catch {
      await saveAIProviderConfigs(previousConfigs).catch(() => undefined);
      await saveAIPanelPreference(previousPreference).catch(() => undefined);
      set({ busy: false, errorMessage: "AI 服务保存失败，请重试" });
      return actionError();
    }
  },
  saveProviderAfterConnectionTest: async (draft) => {
    const existing = draft.id ? get().configs.find((config) => config.id === draft.id) : undefined;
    const validation = validateAIProviderDraft(draft, existing ? get().secretStatus[existing.id] === true : false);
    if (!validation.valid) return { ok: false, issues: validation.issues, message: "请修正配置后再保存" };
    if (!get().dataExfiltrationConfirmed) return { ok: false, code: "data_exfiltration_not_confirmed", message: "请先确认数据外传说明，再测试连接并保存" };

    const configId = validation.value.id ?? nanoid();
    const probeSecret = validation.value.secret;
    const probeConfigId = probeSecret ? `${configId}-probe-${nanoid(8)}` : configId;
    const previousConfigs = get().configs;
    const previousPreference = preferenceFromState(get());
    set({ busy: true, errorMessage: "" });
    let stagedSecret = false;
    try {
      if (probeSecret) {
        await setAIProviderSecret(probeConfigId, probeSecret);
        stagedSecret = true;
      }
      const capability = await testAIProvider({
        providerConfigId: probeConfigId,
        baseUrl: validation.value.baseUrl,
        modelId: validation.value.defaultModelId,
        dataExfiltrationConfirmed: true,
      });
      const now = new Date().toISOString();
      const config: AIProviderConfig = {
        id: configId,
        name: validation.value.name,
        baseUrl: validation.value.baseUrl,
        defaultModelId: validation.value.defaultModelId,
        cachedModelIds: existing?.cachedModelIds ?? [],
        capabilityStatus: capability.chatAvailable ? capability.streaming === "supported" ? "available" : "limited" : "unavailable",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const nextConfigs = existing
        ? previousConfigs.map((item) => item.id === config.id ? config : item)
        : [...previousConfigs, config];
      const nextDefaultProviderConfigId = get().defaultProviderConfigId ?? config.id;
      const nextLastProviderConfigId = existing ? get().lastProviderConfigId : get().lastProviderConfigId ?? nextDefaultProviderConfigId;
      const nextLastModelId = nextLastProviderConfigId === config.id ? config.defaultModelId : get().lastModelId;
      if (stagedSecret) {
        await deleteAIProviderSecret(probeConfigId);
        stagedSecret = false;
      }
      await saveAIProviderConfigs(nextConfigs);
      await saveAIPanelPreference(preferenceFromState(get(), {
        defaultProviderConfigId: nextDefaultProviderConfigId,
        lastProviderConfigId: nextLastProviderConfigId,
        lastModelId: nextLastModelId,
      }));
      if (probeSecret) await setAIProviderSecret(config.id, probeSecret);
      set({
        configs: nextConfigs,
        secretStatus: probeSecret ? { ...get().secretStatus, [config.id]: true } : get().secretStatus,
        defaultProviderConfigId: nextDefaultProviderConfigId,
        lastProviderConfigId: nextLastProviderConfigId,
        lastModelId: nextLastModelId,
        capabilities: { ...get().capabilities, [config.id]: capability },
        connectionStatus: { ...get().connectionStatus, [config.id]: "available" },
        busy: false,
      });
      return { ok: true, configId: config.id };
    } catch (error) {
      if (stagedSecret) await deleteAIProviderSecret(probeConfigId).catch(() => undefined);
      await saveAIProviderConfigs(previousConfigs).catch(() => undefined);
      await saveAIPanelPreference(previousPreference).catch(() => undefined);
      const result = providerErrorAction(error);
      set({ busy: false, errorMessage: toAIProviderError(error).message });
      return result;
    }
  },
  deleteProvider: async (providerConfigId) => {
    const existing = get().configs.find((config) => config.id === providerConfigId);
    if (!existing) return actionError();
    const nextConfigs = get().configs.filter((config) => config.id !== providerConfigId);
    const nextDefaultProviderConfigId = get().defaultProviderConfigId === providerConfigId
      ? nextConfigs[0]?.id ?? null
      : get().defaultProviderConfigId;
    const nextDefaultConfig = nextConfigs.find((config) => config.id === nextDefaultProviderConfigId);
    const lastProviderWasDeleted = get().lastProviderConfigId === providerConfigId;
    const nextLastProviderConfigId = lastProviderWasDeleted ? nextDefaultProviderConfigId : get().lastProviderConfigId;
    const nextLastModelId = lastProviderWasDeleted ? nextDefaultConfig?.defaultModelId ?? null : get().lastModelId;
    const previousConfigs = get().configs;
    const previousPreference = preferenceFromState(get());
    const nextPreference = preferenceFromState(get(), {
      defaultProviderConfigId: nextDefaultProviderConfigId,
      lastProviderConfigId: nextLastProviderConfigId,
      lastModelId: nextLastModelId,
    });
    set({ busy: true, errorMessage: "" });
    try {
      await saveAIProviderConfigs(nextConfigs);
      await saveAIPanelPreference(nextPreference);
      await deleteAIProviderSecret(providerConfigId);
      const secretStatus = { ...get().secretStatus };
      delete secretStatus[providerConfigId];
      const modelIds = { ...get().modelIds };
      const modelLoadStatus = { ...get().modelLoadStatus };
      const modelLoadErrors = { ...get().modelLoadErrors };
      const capabilities = { ...get().capabilities };
      const connectionStatus = { ...get().connectionStatus };
      delete modelIds[providerConfigId];
      delete modelLoadStatus[providerConfigId];
      delete modelLoadErrors[providerConfigId];
      delete capabilities[providerConfigId];
      delete connectionStatus[providerConfigId];
      set({ configs: nextConfigs, secretStatus, modelIds, modelLoadStatus, modelLoadErrors, capabilities, connectionStatus, defaultProviderConfigId: nextDefaultProviderConfigId, lastProviderConfigId: nextLastProviderConfigId, lastModelId: nextLastModelId, busy: false });
      return { ok: true };
    } catch {
      await saveAIProviderConfigs(previousConfigs).catch(() => undefined);
      await saveAIPanelPreference(previousPreference).catch(() => undefined);
      set({ busy: false, errorMessage: "AI 服务删除失败，请重试" });
      return actionError();
    }
  },
  };
}

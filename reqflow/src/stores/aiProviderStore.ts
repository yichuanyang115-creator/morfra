import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  loadAIPanelPreference,
  loadAIProviderConfigs,
  saveAIPanelPreference,
  saveAIProviderConfigs,
} from "../lib/ai/persistence";
import {
  deleteAIProviderSecret,
  hasAIProviderSecret,
  setAIProviderSecret,
} from "../lib/ai/keychainClient";
import { validateAIProviderDraft, type AIProviderDraft, type AIProviderValidationIssues } from "../lib/ai/aiProviderValidation";
import type { AIPanelPreference, AIProviderConfig } from "../types/ai";

export type AIProviderActionResult =
  | { ok: true; configId?: string }
  | { ok: false; issues?: AIProviderValidationIssues; message: string };

interface AIProviderState {
  configs: AIProviderConfig[];
  secretStatus: Record<string, boolean>;
  defaultProviderConfigId: string | null;
  dataExfiltrationConfirmed: boolean;
  lastProviderConfigId: string | null;
  lastModelId: string | null;
  panelOpen: boolean;
  panelWidth: number;
  loaded: boolean;
  busy: boolean;
  errorMessage: string;
  load: () => Promise<void>;
  saveProvider: (draft: AIProviderDraft) => Promise<AIProviderActionResult>;
  setDefaultProvider: (providerConfigId: string) => Promise<AIProviderActionResult>;
  confirmDataExfiltration: () => Promise<AIProviderActionResult>;
  deleteProvider: (providerConfigId: string) => Promise<AIProviderActionResult>;
  clearError: () => void;
}

const DEFAULT_PREFERENCE: AIPanelPreference = {
  open: false,
  width: 360,
  defaultProviderConfigId: null,
  dataExfiltrationConfirmed: false,
  lastProviderConfigId: null,
  lastModelId: null,
};

function preferenceFromState(state: AIProviderState, overrides: Partial<AIPanelPreference> = {}): AIPanelPreference {
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

function actionError(): AIProviderActionResult {
  return { ok: false, message: "AI 服务保存失败，请重试" };
}

export const useAIProviderStore = create<AIProviderState>((set, get) => ({
  configs: [],
  secretStatus: {},
  defaultProviderConfigId: null,
  dataExfiltrationConfirmed: false,
  lastProviderConfigId: null,
  lastModelId: null,
  panelOpen: DEFAULT_PREFERENCE.open,
  panelWidth: DEFAULT_PREFERENCE.width,
  loaded: false,
  busy: false,
  errorMessage: "",

  load: async () => {
    set({ busy: true, errorMessage: "" });
    try {
      const [providerResult, preferenceResult] = await Promise.all([
        loadAIProviderConfigs(),
        loadAIPanelPreference(DEFAULT_PREFERENCE),
      ]);
      const configs = providerResult.value;
      const preferredDefault = preferenceResult.value.defaultProviderConfigId;
      const defaultProviderConfigId = preferredDefault && configs.some((config) => config.id === preferredDefault)
        ? preferredDefault
        : configs[0]?.id ?? null;
      let keychainStatusUnavailable = false;
      const statusEntries = await Promise.all(configs.map(async (config) => {
        try {
          return [config.id, await hasAIProviderSecret(config.id)] as const;
        } catch {
          keychainStatusUnavailable = true;
          return [config.id, false] as const;
        }
      }));
      set({
        configs,
        secretStatus: Object.fromEntries(statusEntries),
        defaultProviderConfigId,
        dataExfiltrationConfirmed: preferenceResult.value.dataExfiltrationConfirmed,
        lastProviderConfigId: preferenceResult.value.lastProviderConfigId,
        lastModelId: preferenceResult.value.lastModelId,
        panelOpen: preferenceResult.value.open,
        panelWidth: preferenceResult.value.width,
        loaded: true,
        busy: false,
        errorMessage: keychainStatusUnavailable ? "系统密钥存储不可用，请检查 macOS Keychain 后重试" : "",
      });
    } catch {
      set({ loaded: true, busy: false, errorMessage: "AI 服务读取失败，请重试" });
    }
  },

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

  setDefaultProvider: async (providerConfigId) => {
    if (!get().configs.some((config) => config.id === providerConfigId)) return actionError();
    const nextPreference = preferenceFromState(get(), {
      defaultProviderConfigId: providerConfigId,
      lastProviderConfigId: providerConfigId,
      lastModelId: get().configs.find((config) => config.id === providerConfigId)?.defaultModelId ?? null,
    });
    try {
      await saveAIPanelPreference(nextPreference);
      set({ defaultProviderConfigId: providerConfigId, lastProviderConfigId: providerConfigId, lastModelId: nextPreference.lastModelId });
      return { ok: true };
    } catch {
      set({ errorMessage: "默认 AI 服务保存失败，请重试" });
      return actionError();
    }
  },

  confirmDataExfiltration: async () => {
    try {
      await saveAIPanelPreference(preferenceFromState(get(), { dataExfiltrationConfirmed: true }));
      set({ dataExfiltrationConfirmed: true });
      return { ok: true };
    } catch {
      set({ errorMessage: "确认状态保存失败，请重试" });
      return actionError();
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
      set({ configs: nextConfigs, secretStatus, defaultProviderConfigId: nextDefaultProviderConfigId, lastProviderConfigId: nextLastProviderConfigId, lastModelId: nextLastModelId, busy: false });
      return { ok: true };
    } catch {
      await saveAIProviderConfigs(previousConfigs).catch(() => undefined);
      await saveAIPanelPreference(previousPreference).catch(() => undefined);
      set({ busy: false, errorMessage: "AI 服务删除失败，请重试" });
      return actionError();
    }
  },

  clearError: () => set({ errorMessage: "" }),
}));

import { create } from "zustand";
import {
  loadAIPanelPreference,
  loadAIProviderConfigs,
  saveAIPanelPreference,
} from "../lib/ai/persistence";
import { hasAIProviderSecret } from "../lib/ai/keychainClient";
import type { AIProviderDraft, AIProviderValidationIssues } from "../lib/ai/aiProviderValidation";
import type {
  AICapabilityProbe,
  AIChatHandle,
  AIChatMessage,
  AIProviderErrorCode,
} from "../lib/ai/providerClient";
import type { AIProviderConfig } from "../types/ai";
import { AI_MAX_WIDTH, AI_MIN_WIDTH } from "../lib/layout/windowLayout";
import { createPersistenceActions } from "./aiProviderStorePersistenceActions";
import { createProviderActions } from "./aiProviderStoreProviderActions";
import {
  actionError,
  DEFAULT_PREFERENCE,
  preferenceFromState,
} from "./aiProviderStoreHelpers";

export type AIProviderActionResult =
  | { ok: true; configId?: string; modelIds?: string[] }
  | { ok: false; issues?: AIProviderValidationIssues; message: string; code?: AIProviderErrorCode };

export type AIModelLoadStatus = "idle" | "loading" | "loaded" | "failed";
export type AIConnectionStatus = "idle" | "testing" | "available" | "failed";
export type AIChatStatus = "idle" | "streaming" | "complete" | "stopped" | "failed";

export interface AIChatActionResult {
  ok: boolean;
  content?: string;
  message?: string;
  code?: AIProviderErrorCode;
}

export interface AIProviderState {
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
  modelIds: Record<string, string[]>;
  modelLoadStatus: Record<string, AIModelLoadStatus>;
  modelLoadErrors: Record<string, string>;
  capabilities: Record<string, AICapabilityProbe>;
  connectionStatus: Record<string, AIConnectionStatus>;
  chatStatus: AIChatStatus;
  chatContent: string;
  chatError: string;
  activeChatHandle: AIChatHandle | null;
  chatCancelRequested: boolean;
  load: () => Promise<void>;
  saveProvider: (draft: AIProviderDraft) => Promise<AIProviderActionResult>;
  saveProviderAfterConnectionTest: (draft: AIProviderDraft) => Promise<AIProviderActionResult>;
  loadModelsForDraft: (draft: AIProviderDraft) => Promise<AIProviderActionResult>;
  setDefaultProvider: (providerConfigId: string) => Promise<AIProviderActionResult>;
  confirmDataExfiltration: () => Promise<AIProviderActionResult>;
  setPanelOpen: (open: boolean) => Promise<AIProviderActionResult>;
  setPanelWidth: (width: number) => Promise<AIProviderActionResult>;
  deleteProvider: (providerConfigId: string) => Promise<AIProviderActionResult>;
  loadModels: (providerConfigId: string) => Promise<AIProviderActionResult>;
  setManualModel: (providerConfigId: string, modelId: string) => Promise<AIProviderActionResult>;
  testProvider: (providerConfigId: string, modelId?: string) => Promise<AIProviderActionResult>;
  startChat: (input: { providerConfigId: string; modelId?: string; messages: AIChatMessage[]; onDelta?: (content: string) => void }) => Promise<AIChatActionResult>;
  cancelChat: () => Promise<AIProviderActionResult>;
  clearError: () => void;
}

export type AIProviderStoreSet = (partial: Partial<AIProviderState>) => void;
export type AIProviderStoreGet = () => AIProviderState;

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
    modelIds: {},
    modelLoadStatus: {},
    modelLoadErrors: {},
    capabilities: {},
    connectionStatus: {},
    chatStatus: "idle",
    chatContent: "",
    chatError: "",
    activeChatHandle: null,
    chatCancelRequested: false,
  ...createPersistenceActions(set, get),
  ...createProviderActions(set, get),
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
        modelIds: Object.fromEntries(configs.map((config) => [config.id, config.cachedModelIds])),
        modelLoadStatus: Object.fromEntries(configs.map((config) => [config.id, config.cachedModelIds.length > 0 ? "loaded" : "idle"])),
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
  setPanelOpen: async (open) => {
    set({ panelOpen: open });
    try {
      await saveAIPanelPreference(preferenceFromState(get(), { open }));
      return { ok: true };
    } catch {
      return actionError();
    }
  },
  setPanelWidth: async (width) => {
    const nextWidth = Math.min(Math.max(width, AI_MIN_WIDTH), AI_MAX_WIDTH);
    set({ panelWidth: nextWidth });
    try {
      await saveAIPanelPreference(preferenceFromState(get(), { width: nextWidth }));
      return { ok: true };
    } catch {
      return actionError();
    }
  },
  clearError: () => set({ errorMessage: "" }),
}));

import { create } from "zustand";
import { readFile, writeFile } from "../lib/fs";
import { createDefaultTheme } from "../lib/themeDefaults";
import { themePath } from "../lib/paths";
import { applyTheme } from "../lib/themeRuntime";
import { validateThemeConfig, type ThemeValidationIssue } from "../lib/themeValidation";
import type { AppThemeConfig, SemanticToken, ThemeColorReference, ThemeModule } from "../types/theme";

interface ThemeState {
  appliedTheme: AppThemeConfig;
  draftTheme: AppThemeConfig | null;
  draftIssues: ThemeValidationIssue[];
  loaded: boolean;
  recoveryNotice: string | null;
  load: () => Promise<void>;
  save: (config: AppThemeConfig) => Promise<boolean>;
  beginDraft: () => void;
  updateDraft: (update: (theme: AppThemeConfig) => AppThemeConfig) => void;
  enableModuleOverride: (moduleName: ThemeModule) => void;
  updateModuleOverride: (moduleName: ThemeModule, token: SemanticToken, value: ThemeColorReference) => void;
  clearModuleOverride: (moduleName: ThemeModule) => void;
  resetDraft: () => void;
  cancelDraft: () => void;
  applyDraft: () => Promise<boolean>;
  acknowledgeRecovery: () => void;
}

function fallbackTheme(): AppThemeConfig {
  return createDefaultTheme();
}

function cloneTheme(config: AppThemeConfig): AppThemeConfig {
  return {
    version: config.version,
    palette: { ...config.palette },
    semantic: { ...config.semantic },
    moduleOverrides: Object.fromEntries(
      Object.entries(config.moduleOverrides).map(([moduleName, overrides]) => [moduleName, overrides ? { ...overrides } : {}]),
    ),
  };
}

function compactTheme(config: AppThemeConfig): AppThemeConfig {
  const cloned = cloneTheme(config);
  cloned.moduleOverrides = Object.fromEntries(
    Object.entries(cloned.moduleOverrides).filter(([, overrides]) => Object.keys(overrides ?? {}).length > 0),
  );
  return cloned;
}

function issuesFor(config: AppThemeConfig): ThemeValidationIssue[] {
  const validation = validateThemeConfig(config);
  return validation.valid ? [] : validation.issues ?? [{ field: "theme", message: validation.reason }];
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  appliedTheme: fallbackTheme(),
  draftTheme: null,
  draftIssues: [],
  loaded: false,
  recoveryNotice: null,

  load: async () => {
    const fallback = fallbackTheme();
    try {
      const raw = await readFile(await themePath());
      if (raw === null) {
        applyTheme(fallback);
        set({ appliedTheme: fallback, draftTheme: null, draftIssues: [], loaded: true, recoveryNotice: null });
        return;
      }

      const validation = validateThemeConfig(JSON.parse(raw) as unknown);
      if (!validation.valid) {
        applyTheme(fallback);
        set({ appliedTheme: fallback, draftTheme: null, draftIssues: [], loaded: true, recoveryNotice: "外观配置无效，已恢复默认主题" });
        return;
      }

      const config = compactTheme(validation.config);
      applyTheme(config);
      set({ appliedTheme: config, draftTheme: null, draftIssues: [], loaded: true, recoveryNotice: null });
    } catch {
      applyTheme(fallback);
      set({ appliedTheme: fallback, draftTheme: null, draftIssues: [], loaded: true, recoveryNotice: "外观配置读取失败，已恢复默认主题" });
    }
  },

  save: async (config) => {
    const validation = validateThemeConfig(config);
    if (!validation.valid) return false;
    const normalized = compactTheme(validation.config);
    await writeFile(await themePath(), JSON.stringify(normalized, null, 2));
    applyTheme(normalized);
    set({ appliedTheme: normalized, draftTheme: null, draftIssues: [], recoveryNotice: null });
    return true;
  },

  beginDraft: () => {
    set({ draftTheme: cloneTheme(get().appliedTheme), draftIssues: [] });
  },

  updateDraft: (update) => {
    const current = get().draftTheme ?? get().appliedTheme;
    const next = update(cloneTheme(current));
    set({ draftTheme: next, draftIssues: issuesFor(next) });
  },

  enableModuleOverride: (moduleName) => {
    get().updateDraft((theme) => ({
      ...theme,
      moduleOverrides: {
        ...theme.moduleOverrides,
        [moduleName]: {},
      },
    }));
  },

  updateModuleOverride: (moduleName, token, value) => {
    get().updateDraft((theme) => ({
      ...theme,
      moduleOverrides: {
        ...theme.moduleOverrides,
        [moduleName]: { ...theme.moduleOverrides[moduleName], [token]: value },
      },
    }));
  },

  clearModuleOverride: (moduleName) => {
    get().updateDraft((theme) => {
      const moduleOverrides = { ...theme.moduleOverrides };
      delete moduleOverrides[moduleName];
      return { ...theme, moduleOverrides };
    });
  },

  resetDraft: () => {
    const next = fallbackTheme();
    set({ draftTheme: next, draftIssues: issuesFor(next) });
  },

  cancelDraft: () => set({ draftTheme: null, draftIssues: [] }),

  applyDraft: async () => {
    const draft = get().draftTheme;
    if (!draft) return false;
    const validation = validateThemeConfig(draft);
    if (!validation.valid) {
      set({ draftIssues: validation.issues ?? [{ field: "theme", message: validation.reason }] });
      return false;
    }
    const normalized = compactTheme(validation.config);
    try {
      await writeFile(await themePath(), JSON.stringify(normalized, null, 2));
      applyTheme(normalized);
      set({ appliedTheme: normalized, draftTheme: normalized, draftIssues: [], recoveryNotice: null });
      return true;
    } catch {
      set({ draftIssues: [{ field: "theme", message: "主题保存失败，请重试" }] });
      return false;
    }
  },

  acknowledgeRecovery: () => set({ recoveryNotice: null }),
}));

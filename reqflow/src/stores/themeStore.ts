import { create } from "zustand";
import { readFile, writeFile } from "../lib/fs";
import { createDefaultTheme } from "../lib/themeDefaults";
import { themePath } from "../lib/paths";
import { applyTheme } from "../lib/themeRuntime";
import { validateThemeConfig } from "../lib/themeValidation";
import type { AppThemeConfig } from "../types/theme";

interface ThemeState {
  appliedTheme: AppThemeConfig;
  loaded: boolean;
  recoveryNotice: string | null;
  load: () => Promise<void>;
  save: (config: AppThemeConfig) => Promise<boolean>;
  acknowledgeRecovery: () => void;
}

function fallbackTheme(): AppThemeConfig {
  return createDefaultTheme();
}

export const useThemeStore = create<ThemeState>((set) => ({
  appliedTheme: fallbackTheme(),
  loaded: false,
  recoveryNotice: null,

  load: async () => {
    const fallback = fallbackTheme();
    try {
      const raw = await readFile(await themePath());
      if (raw === null) {
        applyTheme(fallback);
        set({ appliedTheme: fallback, loaded: true, recoveryNotice: null });
        return;
      }

      const validation = validateThemeConfig(JSON.parse(raw) as unknown);
      if (!validation.valid) {
        applyTheme(fallback);
        set({ appliedTheme: fallback, loaded: true, recoveryNotice: "外观配置无效，已恢复默认主题" });
        return;
      }

      applyTheme(validation.config);
      set({ appliedTheme: validation.config, loaded: true, recoveryNotice: null });
    } catch {
      applyTheme(fallback);
      set({ appliedTheme: fallback, loaded: true, recoveryNotice: "外观配置读取失败，已恢复默认主题" });
    }
  },

  save: async (config) => {
    const validation = validateThemeConfig(config);
    if (!validation.valid) return false;
    await writeFile(await themePath(), JSON.stringify(validation.config, null, 2));
    applyTheme(validation.config);
    set({ appliedTheme: validation.config, recoveryNotice: null });
    return true;
  },

  acknowledgeRecovery: () => set({ recoveryNotice: null }),
}));

import { THEME_CONFIG_VERSION, type AppThemeConfig, type PrimitivePalette, type SemanticTheme } from "../types/theme";

/** Design-Brief V3-DB-011 的唯一默认基础色板。 */
export const DEFAULT_PALETTE: PrimitivePalette = {
  canvas: "#F5F7FA",
  surface: "#FFFFFF",
  ink: "#1F2937",
  neutral700: "#4B5563",
  neutral500: "#6B7280",
  neutral300: "#D1D5DB",
  neutral100: "#E5E7EB",
  neutral50: "#EEF1F5",
  blue700: "#2559C7",
  blue500: "#2F6FED",
  blue100: "#8FB2FF",
  blue50: "#E7EFFF",
  success: "#176B3A",
  danger: "#C62828",
  warning: "#7A4B00",
};

/** 语义层默认引用 Primitive，而非复制 Hex。 */
export const DEFAULT_SEMANTIC: SemanticTheme = {
  backgroundCanvas: "canvas",
  backgroundSurface: "surface",
  backgroundElevated: "neutral50",
  textPrimary: "ink",
  textSecondary: "neutral700",
  textTertiary: "neutral500",
  textDisabled: "neutral500",
  borderSubtle: "neutral100",
  borderStrong: "neutral300",
  actionStrong: "blue700",
  actionBase: "blue500",
  actionSoft: "blue50",
  contextStrong: "blue700",
  contextSoft: "blue50",
  feedbackSuccess: "success",
  feedbackWarning: "warning",
  feedbackDanger: "danger",
};

export const DEFAULT_THEME_CONFIG: AppThemeConfig = {
  version: THEME_CONFIG_VERSION,
  palette: DEFAULT_PALETTE,
  semantic: DEFAULT_SEMANTIC,
  moduleOverrides: {},
};

export function createDefaultTheme(): AppThemeConfig {
  return {
    version: THEME_CONFIG_VERSION,
    palette: { ...DEFAULT_PALETTE },
    semantic: { ...DEFAULT_SEMANTIC },
    moduleOverrides: {},
  };
}

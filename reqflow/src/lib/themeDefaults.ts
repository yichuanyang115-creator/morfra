import { THEME_CONFIG_VERSION, type AppThemeConfig, type PrimitivePalette, type SemanticTheme } from "../types/theme";

/** Design-Brief §3.1 的唯一默认基础色板。 */
export const DEFAULT_PALETTE: PrimitivePalette = {
  canvas: "#FCFCFA",
  surface: "#FFFFFF",
  ink: "#2B2421",
  green600: "#3F7A02",
  green500: "#5DA802",
  green50: "#F4FAEC",
  purple700: "#5D3A73",
  purple500: "#76558C",
  purple100: "#E8DDF0",
  purple50: "#F5EFF8",
  success: "#2C7A63",
  danger: "#B3261E",
  warning: "#7A5200",
};

/** Design-Brief §3.2：语义层默认引用 Primitive，而非复制 Hex。 */
export const DEFAULT_SEMANTIC: SemanticTheme = {
  backgroundCanvas: "canvas",
  backgroundSurface: "surface",
  backgroundElevated: "purple50",
  textPrimary: "ink",
  textSecondary: "purple700",
  textTertiary: "purple500",
  textDisabled: "purple500",
  borderSubtle: "purple100",
  borderStrong: "#B9A6C6",
  actionStrong: "green600",
  actionBase: "green500",
  actionSoft: "green50",
  contextStrong: "purple700",
  contextSoft: "purple50",
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

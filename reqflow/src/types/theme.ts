export const THEME_CONFIG_VERSION = 2 as const;

export const PALETTE_KEYS = [
  "canvas",
  "surface",
  "ink",
  "neutral700",
  "neutral500",
  "neutral300",
  "neutral100",
  "neutral50",
  "blue700",
  "blue500",
  "blue100",
  "blue50",
  "success",
  "danger",
  "warning",
] as const;

export type PaletteKey = (typeof PALETTE_KEYS)[number];

export interface PrimitivePalette {
  canvas: string;
  surface: string;
  ink: string;
  neutral700: string;
  neutral500: string;
  neutral300: string;
  neutral100: string;
  neutral50: string;
  blue700: string;
  blue500: string;
  blue100: string;
  blue50: string;
  success: string;
  danger: string;
  warning: string;
}

export const SEMANTIC_TOKENS = [
  "backgroundCanvas",
  "backgroundSurface",
  "backgroundElevated",
  "textPrimary",
  "textSecondary",
  "textTertiary",
  "textDisabled",
  "borderSubtle",
  "borderStrong",
  "actionStrong",
  "actionBase",
  "actionSoft",
  "contextStrong",
  "contextSoft",
  "feedbackSuccess",
  "feedbackWarning",
  "feedbackDanger",
] as const;

export type SemanticToken = (typeof SEMANTIC_TOKENS)[number];
export type ThemeColorReference = PaletteKey | string;
export type SemanticTheme = Record<SemanticToken, ThemeColorReference>;

export const THEME_MODULES = ["topbar", "board", "detail", "settings", "chat", "business", "feedback"] as const;

export type ThemeModule = (typeof THEME_MODULES)[number];
export type ModuleTokenOverrides = Partial<Record<SemanticToken, ThemeColorReference>>;
export type ModuleOverrides = Partial<Record<ThemeModule, ModuleTokenOverrides>>;

export interface AppThemeConfig {
  version: typeof THEME_CONFIG_VERSION;
  palette: PrimitivePalette;
  semantic: SemanticTheme;
  /** 仅保存用户主动开启的模块覆盖；缺省时所有模块继续继承 semantic。 */
  moduleOverrides: ModuleOverrides;
}

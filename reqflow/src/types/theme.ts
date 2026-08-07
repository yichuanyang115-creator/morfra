export const THEME_CONFIG_VERSION = 1 as const;

export const PALETTE_KEYS = [
  "canvas",
  "surface",
  "ink",
  "green600",
  "green500",
  "green50",
  "purple700",
  "purple500",
  "purple100",
  "purple50",
  "success",
  "danger",
  "warning",
] as const;

export type PaletteKey = (typeof PALETTE_KEYS)[number];

export interface PrimitivePalette {
  canvas: string;
  surface: string;
  ink: string;
  green600: string;
  green500: string;
  green50: string;
  purple700: string;
  purple500: string;
  purple100: string;
  purple50: string;
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

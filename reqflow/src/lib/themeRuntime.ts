import { THEME_MODULES, type AppThemeConfig, type PaletteKey, type SemanticToken, type ThemeColorReference, type ThemeModule } from "../types/theme";

export interface ResolvedTheme {
  palette: Record<PaletteKey, string>;
  semantic: Record<SemanticToken, string>;
  /** 每个模块先继承完整 semantic，再叠加用户显式覆盖。 */
  modules: Record<ThemeModule, Record<string, string>>;
}

const SEMANTIC_CSS_VARIABLES: Record<SemanticToken, string> = {
  backgroundCanvas: "--semantic-background-canvas",
  backgroundSurface: "--semantic-background-surface",
  backgroundElevated: "--semantic-background-elevated",
  textPrimary: "--semantic-text-primary",
  textSecondary: "--semantic-text-secondary",
  textTertiary: "--semantic-text-tertiary",
  textDisabled: "--semantic-text-disabled",
  borderSubtle: "--semantic-border-subtle",
  borderStrong: "--semantic-border-strong",
  actionStrong: "--semantic-action-strong",
  actionBase: "--semantic-action-base",
  actionSoft: "--semantic-action-soft",
  contextStrong: "--semantic-context-strong",
  contextSoft: "--semantic-context-soft",
  feedbackSuccess: "--semantic-feedback-success",
  feedbackWarning: "--semantic-feedback-warning",
  feedbackDanger: "--semantic-feedback-danger",
};

const LEGACY_VARIABLES: Record<string, SemanticToken> = {
  "--bg": "backgroundCanvas",
  "--surface": "backgroundSurface",
  "--surface-2": "backgroundElevated",
  "--topbar": "backgroundCanvas",
  "--fg": "textPrimary",
  "--muted": "textSecondary",
  "--muted-2": "textTertiary",
  "--border": "borderSubtle",
  "--border-strong": "borderStrong",
  "--accent": "actionBase",
  "--accent-text": "actionStrong",
  "--accent-soft": "actionSoft",
  "--accent-soft-strong": "contextSoft",
  "--accent-solid": "actionStrong",
  "--accent-solid-fg": "backgroundSurface",
  "--accent-selected": "contextSoft",
  "--context-strong": "contextStrong",
  "--sev-p0": "feedbackDanger",
  "--sev-p1": "feedbackWarning",
  "--sev-p2": "contextStrong",
  "--st-todo": "contextStrong",
  "--st-progress": "actionBase",
  "--st-done": "feedbackSuccess",
  "--st-blocked": "feedbackDanger",
};

const LEGACY_SOFT_VARIABLES: Record<string, string> = {
  "--sev-p0-soft": "color-mix(in srgb, var(--semantic-feedback-danger) 12%, var(--semantic-background-surface))",
  "--sev-p1-soft": "color-mix(in srgb, var(--semantic-feedback-warning) 12%, var(--semantic-background-surface))",
  "--sev-p2-soft": "var(--semantic-context-soft)",
  "--st-todo-soft": "var(--semantic-context-soft)",
  "--st-progress-soft": "var(--semantic-action-soft)",
  "--st-done-soft": "color-mix(in srgb, var(--semantic-feedback-success) 12%, var(--semantic-background-surface))",
  "--st-blocked-soft": "color-mix(in srgb, var(--semantic-feedback-danger) 12%, var(--semantic-background-surface))",
};

function resolveReference(reference: ThemeColorReference, palette: AppThemeConfig["palette"]): string {
  return reference in palette ? palette[reference as PaletteKey] : reference;
}

export function resolveTheme(config: AppThemeConfig): ResolvedTheme {
  const palette = { ...config.palette };
  const semantic = Object.fromEntries(
    Object.entries(config.semantic).map(([key, reference]) => [key, resolveReference(reference, palette)]),
  ) as Record<SemanticToken, string>;
  const modules = Object.fromEntries(
    THEME_MODULES.map((moduleName) => [
      moduleName,
      {
        ...semantic,
        ...Object.fromEntries(
          Object.entries(config.moduleOverrides[moduleName] ?? {}).map(([token, reference]) => [token, resolveReference(reference, palette)]),
        ),
      },
    ]),
  ) as unknown as Record<ThemeModule, Record<string, string>>;
  return { palette, semantic, modules };
}

export function applyTheme(config: AppThemeConfig, root: CSSStyleDeclaration = document.documentElement.style): ResolvedTheme {
  const resolved = resolveTheme(config);

  for (const [key, value] of Object.entries(resolved.palette)) root.setProperty(`--palette-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  for (const [token, cssVariable] of Object.entries(SEMANTIC_CSS_VARIABLES)) root.setProperty(cssVariable, resolved.semantic[token as SemanticToken]);
  for (const [moduleName, tokens] of Object.entries(resolved.modules)) {
    for (const [token, value] of Object.entries(tokens)) {
      root.setProperty(`--module-${moduleName}-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
    }
  }
  for (const [cssVariable, token] of Object.entries(LEGACY_VARIABLES)) root.setProperty(cssVariable, resolved.semantic[token]);
  for (const [cssVariable, value] of Object.entries(LEGACY_SOFT_VARIABLES)) root.setProperty(cssVariable, value);

  return resolved;
}

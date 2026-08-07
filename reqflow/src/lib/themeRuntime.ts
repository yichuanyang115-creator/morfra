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
  return resolved;
}

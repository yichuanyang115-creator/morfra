import {
  PALETTE_KEYS,
  SEMANTIC_TOKENS,
  THEME_CONFIG_VERSION,
  THEME_MODULES,
  type AppThemeConfig,
  type PaletteKey,
  type ThemeColorReference,
} from "../types/theme";

export interface ThemeValidationIssue {
  field: string;
  message: string;
}

export type ThemeValidationResult =
  | { valid: true; config: AppThemeConfig }
  | { valid: false; reason: string; issues?: ThemeValidationIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/** 纯白与默认暖白允许，其他中性灰被禁用。 */
export function isForbiddenGray(value: string): boolean {
  if (!isHexColor(value)) return false;
  if (value.toUpperCase() === "#FFFFFF" || value.toUpperCase() === "#FCFCFA") return false;
  const channels = [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
  return Math.max(...channels) - Math.min(...channels) <= 4;
}

function isPaletteKey(value: string): value is PaletteKey {
  return PALETTE_KEYS.some((key) => key === value);
}

function isColorReference(value: unknown): value is ThemeColorReference {
  return typeof value === "string" && (isPaletteKey(value) || (isHexColor(value) && !isForbiddenGray(value)));
}

function resolveColor(reference: ThemeColorReference, palette: AppThemeConfig["palette"]): string {
  return isPaletteKey(reference) ? palette[reference] : reference;
}

type ReservedColorFamily = "red" | "yellow" | "green" | "other";

function reservedColorFamily(value: string): ReservedColorFamily {
  if (!isHexColor(value)) return "other";
  const channels = [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  const spread = max - min;
  if (spread < 0.2 || max === 0) return "other";
  let hue = 0;
  if (max === channels[0]) hue = 60 * (((channels[1] - channels[2]) / spread) % 6);
  else if (max === channels[1]) hue = 60 * ((channels[2] - channels[0]) / spread + 2);
  else hue = 60 * ((channels[0] - channels[1]) / spread + 4);
  if (hue < 0) hue += 360;
  if (hue >= 345 || hue < 20) return "red";
  if (hue >= 20 && hue < 75) return "yellow";
  if (hue >= 75 && hue < 185) return "green";
  return "other";
}

function relativeLuminance(value: string): number {
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset + 1, offset + 3), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(first: string, second: string): number {
  if (!isHexColor(first) || !isHexColor(second)) return 0;
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function collectContrastIssues(config: AppThemeConfig): ThemeValidationIssue[] {
  const pairs: Array<[keyof AppThemeConfig["semantic"], keyof AppThemeConfig["semantic"], number]> = [
    ["textPrimary", "backgroundCanvas", 4.5],
    ["textPrimary", "backgroundSurface", 4.5],
    ["textPrimary", "backgroundElevated", 4.5],
    ["textPrimary", "contextSoft", 4.5],
    ["textPrimary", "actionSoft", 4.5],
    ["textSecondary", "backgroundSurface", 4.5],
    ["textSecondary", "backgroundElevated", 4.5],
    ["textTertiary", "backgroundSurface", 4.5],
    ["textDisabled", "backgroundSurface", 3],
    ["actionStrong", "backgroundSurface", 4.5],
    ["actionStrong", "backgroundCanvas", 4.5],
    ["contextStrong", "backgroundSurface", 4.5],
    ["contextStrong", "contextSoft", 4.5],
    ["feedbackSuccess", "backgroundSurface", 4.5],
    ["feedbackWarning", "backgroundSurface", 4.5],
    ["feedbackDanger", "backgroundSurface", 4.5],
  ];
  const contrastIssues = pairs.flatMap(([foreground, background, minimum]) => {
    const foregroundColor = resolveColor(config.semantic[foreground], config.palette);
    const backgroundColor = resolveColor(config.semantic[background], config.palette);
    if (contrastRatio(foregroundColor, backgroundColor) >= minimum) return [];
    return [{
      field: "semantic." + foreground,
      message: foreground + " 与 " + background + " 对比度不足（需 ≥" + minimum + ":1）",
    }];
  });
  const focusColor = resolveColor(config.semantic.actionBase, config.palette);
  const surfaceColor = resolveColor(config.semantic.backgroundSurface, config.palette);
  if (contrastRatio(focusColor, surfaceColor) < 3) {
    contrastIssues.push({
      field: "semantic.actionBase",
      message: "actionBase 与 backgroundSurface 对比度不足（需 ≥3:1）",
    });
  }
  return contrastIssues;
}

function collectRoleIssues(config: AppThemeConfig): ThemeValidationIssue[] {
  return SEMANTIC_TOKENS.flatMap((token) => {
    const family = reservedColorFamily(resolveColor(config.semantic[token], config.palette));
    if (token === "feedbackDanger" && family !== "red") {
      return [{ field: "semantic." + token, message: "危险反馈只能使用红色语义色" }];
    }
    if (token === "feedbackWarning" && family !== "yellow") {
      return [{ field: "semantic." + token, message: "警告反馈只能使用黄色语义色" }];
    }
    if (token === "feedbackSuccess" && family !== "green") {
      return [{ field: "semantic." + token, message: "成功反馈只能使用绿色语义色" }];
    }
    if (token !== "feedbackDanger" && token !== "feedbackWarning" && (family === "red" || family === "yellow")) {
      return [{ field: "semantic." + token, message: "普通操作和结构角色不能占用红色或黄色保留色" }];
    }
    return [];
  });
}

export function validateThemeConfig(value: unknown): ThemeValidationResult {
  if (!isRecord(value)) {
    return { valid: false, reason: "配置不是对象", issues: [{ field: "theme", message: "配置不是对象" }] };
  }
  if (value.version !== THEME_CONFIG_VERSION) {
    return { valid: false, reason: "配置版本不受支持", issues: [{ field: "version", message: "配置版本不受支持" }] };
  }
  if (!isRecord(value.palette) || !isRecord(value.semantic) || !isRecord(value.moduleOverrides)) {
    return { valid: false, reason: "配置结构不完整", issues: [{ field: "theme", message: "配置结构不完整" }] };
  }

  for (const key of PALETTE_KEYS) {
    const color = value.palette[key];
    if (typeof color !== "string" || !isHexColor(color) || isForbiddenGray(color)) {
      return {
        valid: false,
        reason: "基础色 " + key + " 无效",
        issues: [{ field: "palette." + key, message: "基础色 " + key + " 必须是非灰色六位 Hex" }],
      };
    }
  }

  for (const token of SEMANTIC_TOKENS) {
    if (!isColorReference(value.semantic[token])) {
      return {
        valid: false,
        reason: "语义色 " + token + " 无效",
        issues: [{ field: "semantic." + token, message: "语义色 " + token + " 必须是合法颜色或基础色引用" }],
      };
    }
  }

  for (const [moduleName, overrides] of Object.entries(value.moduleOverrides)) {
    if (!THEME_MODULES.some((module) => module === moduleName) || !isRecord(overrides)) {
      return { valid: false, reason: "模块覆盖无效", issues: [{ field: "moduleOverrides." + moduleName, message: "模块覆盖无效" }] };
    }
    if (!Object.values(overrides).every(isColorReference)) {
      return {
        valid: false,
        reason: "模块 " + moduleName + " 的颜色无效",
        issues: [{ field: "moduleOverrides." + moduleName, message: "模块 " + moduleName + " 的颜色无效" }],
      };
    }
  }

  const roleIssues = collectRoleIssues(value as unknown as AppThemeConfig);
  if (roleIssues.length > 0) {
    return { valid: false, reason: roleIssues[0].message, issues: roleIssues };
  }

  const contrastIssues = collectContrastIssues(value as unknown as AppThemeConfig);
  if (contrastIssues.length > 0) {
    return { valid: false, reason: contrastIssues[0].message, issues: contrastIssues };
  }

  return { valid: true, config: value as unknown as AppThemeConfig };
}

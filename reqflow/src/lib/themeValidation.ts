import { PALETTE_KEYS, SEMANTIC_TOKENS, THEME_CONFIG_VERSION, THEME_MODULES, type AppThemeConfig, type PaletteKey, type ThemeColorReference } from "../types/theme";

export type ThemeValidationResult =
  | { valid: true; config: AppThemeConfig }
  | { valid: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/** 纯白与默认暖白允许，其他中性灰被禁用。 */
export function isForbiddenGray(value: string): boolean {
  if (!isHexColor(value)) return false;
  // 纯白表面和 Design-Brief 定义的暖白画布是明确允许的基底；不能靠亮度阈值
  // 放行任意浅灰，否则 #F7F7F7 这类输入会绕过“禁灰”门禁。
  if (value.toUpperCase() === "#FFFFFF" || value.toUpperCase() === "#FCFCFA") return false;
  const channels = [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
  const spread = Math.max(...channels) - Math.min(...channels);
  return spread <= 4;
}

function isPaletteKey(value: string): value is PaletteKey {
  return PALETTE_KEYS.some((key) => key === value);
}

function isColorReference(value: unknown): value is ThemeColorReference {
  return typeof value === "string" && (isPaletteKey(value) || (isHexColor(value) && !isForbiddenGray(value)));
}

export function validateThemeConfig(value: unknown): ThemeValidationResult {
  if (!isRecord(value)) return { valid: false, reason: "配置不是对象" };
  if (value.version !== THEME_CONFIG_VERSION) return { valid: false, reason: "配置版本不受支持" };
  if (!isRecord(value.palette) || !isRecord(value.semantic) || !isRecord(value.moduleOverrides)) {
    return { valid: false, reason: "配置结构不完整" };
  }

  for (const key of PALETTE_KEYS) {
    const color = value.palette[key];
    if (typeof color !== "string" || !isHexColor(color) || isForbiddenGray(color)) {
      return { valid: false, reason: `基础色 ${key} 无效` };
    }
  }

  for (const token of SEMANTIC_TOKENS) {
    if (!isColorReference(value.semantic[token])) return { valid: false, reason: `语义色 ${token} 无效` };
  }

  for (const [moduleName, overrides] of Object.entries(value.moduleOverrides)) {
    if (!THEME_MODULES.some((module) => module === moduleName) || !isRecord(overrides)) {
      return { valid: false, reason: "模块覆盖无效" };
    }
    if (!Object.values(overrides).every(isColorReference)) return { valid: false, reason: `模块 ${moduleName} 的颜色无效` };
  }

  // 上面的逐字段运行时校验已经建立了 AppThemeConfig 的完整边界；unknown 中转避免把
  // 任意 Record 误当成结构类型的断言警告。
  return { valid: true, config: value as unknown as AppThemeConfig };
}

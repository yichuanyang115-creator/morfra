/**
 * 阶段/单选选项的预设色板（Product-Spec REQ-025、Design-Brief §4.8）。
 * 只在绿/紫两组内稳定轮询：不因重排改变已分配颜色，也不引入灰、红、黄装饰色。
 */
export const STAGE_PALETTE: string[] = [
  "#3F7A02",
  "#5D3A73",
  "#5B9F00",
  "#76558C",
  "#4E8A12",
  "#6F4C8E",
  "#4A8115",
  "#80599A",
];

export function paletteColorAt(index: number): string {
  return STAGE_PALETTE[index % STAGE_PALETTE.length];
}

function generatedFallbackColor(index: number): string {
  const family = index % 2;
  const variant = Math.floor(index / 2);
  const channel = (base: number, step: number, modulo: number) => base + ((variant * step) % modulo);
  const rgb = family === 0
    ? [channel(28, 11, 60), channel(96, 7, 55), channel(24, 5, 40)]
    : [channel(55, 13, 75), channel(35, 7, 40), channel(130, 17, 60)];
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** 新增阶段/选项时优先取尚未使用的色板值，删除后不会让新值撞上存量颜色。 */
export function nextPaletteColor(existingColors: Iterable<string | undefined>): string {
  const used = new Set(
    Array.from(existingColors)
      .filter((color): color is string => color !== undefined)
      .map((color) => color.toUpperCase()),
  );
  const preset = STAGE_PALETTE.find((color) => !used.has(color.toUpperCase()));
  if (preset) return preset;
  for (let offset = 0; offset < 4096; offset += 1) {
    const candidate = generatedFallbackColor(used.size + offset);
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("Schema 颜色候选已耗尽");
}

export type SchemaColorValidation = { valid: true } | { valid: false; message: string };

function relativeLuminance(value: string): number {
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset + 1, offset + 3), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** 手动 Schema 颜色只接受可辨识的六位 Hex；已有旧格式颜色由迁移逻辑原样保留。 */
export function validateSchemaColor(value: string): SchemaColorValidation {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return { valid: false, message: "请输入六位 Hex 颜色，例如 #5B9F00" };
  const channels = [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  if (Math.max(...channels) - Math.min(...channels) <= 12) return { valid: false, message: "不能使用灰色，请选择带有色相的颜色" };
  const contrastWithWhite = 1.05 / (relativeLuminance(value) + 0.05);
  if (contrastWithWhite < 3) return { valid: false, message: "颜色过浅，在白色背景上不可辨识" };
  return { valid: true };
}

/** Schema 选项可以保留旧项目自定义色，但提醒用户不要把反馈语义色挪来表达普通选项。 */
export function schemaColorWarning(value: string): string | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return null;
  const [red, green, blue] = [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  if (red > green * 1.35 && red > blue * 1.35) return "红色仅建议用于危险反馈，Schema 选项更建议使用绿/紫";
  if (red > blue * 1.25 && green > blue * 1.25 && Math.abs(red - green) < 100) return "黄色仅建议用于警告反馈，Schema 选项更建议使用绿/紫";
  return null;
}

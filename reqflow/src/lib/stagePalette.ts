/**
 * 阶段/单选选项的预设色板（Schema 讨论稿 §2：8 色，HSL 均匀分布，默认按顺序分配）。
 * 固定饱和度/明度，只在色相上均匀取 8 个点，保证浅色系统里彼此可辨又不过于鲜艳。
 */
const PALETTE_SIZE = 8;
const SATURATION = 55;
const LIGHTNESS = 88;

export const STAGE_PALETTE: string[] = Array.from({ length: PALETTE_SIZE }, (_, i) => {
  const hue = Math.round((360 / PALETTE_SIZE) * i);
  return `hsl(${hue}, ${SATURATION}%, ${LIGHTNESS}%)`;
});

export function paletteColorAt(index: number): string {
  return STAGE_PALETTE[index % STAGE_PALETTE.length];
}

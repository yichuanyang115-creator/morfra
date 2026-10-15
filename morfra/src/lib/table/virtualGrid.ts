export const GRID_OVERSCAN = 4;

export function visibleRange(start: number, size: number, itemSize: number, count: number, overscan = GRID_OVERSCAN): { start: number; end: number } {
  const first = Math.max(0, Math.floor(start / itemSize) - overscan);
  const last = Math.min(count, Math.ceil((start + size) / itemSize) + overscan);
  return { start: first, end: Math.max(first, last) };
}

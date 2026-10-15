export interface GridPoint {
  row: number;
  column: number;
}

export interface GridRange {
  anchor: GridPoint;
  focus: GridPoint;
}

export interface GridSelection {
  active: GridPoint;
  range: GridRange;
  rows: number[];
}

export function singleCell(point: GridPoint): GridSelection {
  return { active: point, range: { anchor: point, focus: point }, rows: [] };
}

export function extendRange(selection: GridSelection, focus: GridPoint): GridSelection {
  return { ...selection, active: focus, range: { anchor: selection.range.anchor, focus }, rows: [] };
}

export function moveActive(selection: GridSelection, point: GridPoint, extend: boolean): GridSelection {
  return extend ? extendRange(selection, point) : singleCell(point);
}

export function rangeBounds(range: GridRange): { top: number; right: number; bottom: number; left: number } {
  return {
    top: Math.min(range.anchor.row, range.focus.row),
    right: Math.max(range.anchor.column, range.focus.column),
    bottom: Math.max(range.anchor.row, range.focus.row),
    left: Math.min(range.anchor.column, range.focus.column),
  };
}

export function containsCell(selection: GridSelection | null, point: GridPoint): boolean {
  if (!selection || selection.rows.length > 0) return Boolean(selection?.rows.includes(point.row));
  const bounds = rangeBounds(selection.range);
  return point.row >= bounds.top && point.row <= bounds.bottom && point.column >= bounds.left && point.column <= bounds.right;
}

export function selectRows(selection: GridSelection | null, row: number, mode: "single" | "range" | "toggle"): GridSelection {
  const active = { row, column: selection?.active.column ?? 0 };
  if (mode === "single") return { active, range: { anchor: active, focus: active }, rows: [row] };
  if (mode === "toggle") {
    const rows = new Set(selection?.rows ?? []);
    rows.has(row) ? rows.delete(row) : rows.add(row);
    const sortedRows = [...rows].sort((left, right) => left - right);
    const nextActive = { row: sortedRows.includes(row) || !sortedRows.length ? row : sortedRows[0], column: active.column };
    return { active: nextActive, range: { anchor: nextActive, focus: nextActive }, rows: sortedRows };
  }
  const anchor = selection?.range.anchor.row ?? selection?.active.row ?? row;
  const rows = Array.from({ length: Math.abs(row - anchor) + 1 }, (_, index) => Math.min(row, anchor) + index);
  return { active, range: { anchor: { row: anchor, column: active.column }, focus: active }, rows };
}

export function clampPoint(point: GridPoint, rowCount: number, columnCount: number): GridPoint {
  return { row: Math.min(Math.max(point.row, 0), Math.max(rowCount - 1, 0)), column: Math.min(Math.max(point.column, 0), Math.max(columnCount - 1, 0)) };
}

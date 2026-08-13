import type { FieldSummary, JsonValue } from "../../types/domain";
import { parseGridLayout, type GridLayoutConfig } from "../table/DataGrid";

export function parseCachedGridLayout(raw: string | null, fields: FieldSummary[]): GridLayoutConfig {
  try {
    const stored: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(stored)) return parseGridLayout({ fieldIds: stored }, fields);
    return parseGridLayout(isJsonRecord(stored) ? stored : {}, fields);
  } catch { return parseGridLayout({}, fields); }
}

export function parseLoadingGridLayout(raw: string | null, titleFieldId: string): GridLayoutConfig {
  try {
    const stored: unknown = raw ? JSON.parse(raw) : null;
    const source = isJsonRecord(stored) ? stored : {};
    const requestedIds = Array.isArray(source.fieldIds) ? source.fieldIds.filter((id): id is string => typeof id === "string") : [];
    const fieldIds = [...new Set([titleFieldId, ...requestedIds.filter((id) => id !== titleFieldId)])];
    const columnWidths = isJsonRecord(source.columnWidths) ? Object.fromEntries(Object.entries(source.columnWidths).filter((entry): entry is [string, number] => typeof entry[1] === "number")) : {};
    return { fieldIds, columnWidths, frozenFieldId: typeof source.frozenFieldId === "string" ? source.frozenFieldId : null, rowHeight: source.rowHeight === 32 || source.rowHeight === 56 ? source.rowHeight : 40 };
  } catch { return { fieldIds: [titleFieldId], columnWidths: {}, frozenFieldId: null, rowHeight: 40 }; }
}

export function gridLayoutSaveRollback(confirmed: GridLayoutConfig | undefined, fallback: GridLayoutConfig | null): GridLayoutConfig | null { return confirmed ?? fallback; }
export interface GridLayoutSaveCoordinator { confirm(viewId: string, layout: GridLayoutConfig): void; getConfirmed(viewId: string): GridLayoutConfig | undefined; enqueue(persist: () => Promise<void>): Promise<void>; }
export function createGridLayoutSaveCoordinator(): GridLayoutSaveCoordinator { let queue = Promise.resolve(); const confirmedLayouts = new Map<string, GridLayoutConfig>(); return { confirm(viewId, layout) { confirmedLayouts.set(viewId, layout); }, getConfirmed(viewId) { return confirmedLayouts.get(viewId); }, enqueue(persist) { queue = queue.then(persist, persist); return queue; } }; }
export function shouldRollbackGridLayoutSave(currentVersion: number, saveVersion: number, currentViewId: string | null, saveViewId: string): boolean { return currentVersion === saveVersion && currentViewId === saveViewId; }
export function shouldShowGridSkeleton(hasTableData: boolean, tableDataLoading: boolean, gridLayoutReady: boolean, hasLoadError: boolean): boolean { return (!hasTableData && !hasLoadError) || (hasTableData && !gridLayoutReady) || (!hasTableData && tableDataLoading); }
export function resetGridFieldLayout(current: GridLayoutConfig, fieldIds: string[]): GridLayoutConfig { return { fieldIds, columnWidths: {}, frozenFieldId: null, rowHeight: current.rowHeight, pipeline: current.pipeline }; }
function isJsonRecord(value: unknown): value is Record<string, JsonValue> { return typeof value === "object" && value !== null && !Array.isArray(value); }

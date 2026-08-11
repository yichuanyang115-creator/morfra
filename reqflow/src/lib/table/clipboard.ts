import type { FieldSummary, JsonValue, RecordData } from "../../types/domain";
import { rangeBounds, type GridSelection } from "./selectionModel";
import { valueForCell } from "../../components/table/cellValue";

export const MORFRA_CLIPBOARD_MIME = "application/x-morfra-table+json";

export interface MorfraClipboard {
  version: 1;
  values: JsonValue[][];
  fieldIds: string[];
}

export function parseTsv(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = normalized.endsWith("\n") ? normalized.slice(0, -1).split("\n") : normalized.split("\n");
  return rows.length === 1 && rows[0] === "" ? [[""]] : rows.map((row) => row.split("\t"));
}

export function selectionClipboard(selection: GridSelection, fields: FieldSummary[], records: RecordData[]): MorfraClipboard {
  const rowIndexes = selection.rows.length ? selection.rows : rangeRows(selection);
  const columnIndexes = selection.rows.length ? [selection.active.column] : rangeColumns(selection);
  const selectedFields = columnIndexes.map((index) => fields[index]).filter((field): field is FieldSummary => Boolean(field));
  return {
    version: 1,
    fieldIds: selectedFields.map((field) => field.id),
    values: rowIndexes.map((rowIndex) => selectedFields.map((field) => records[rowIndex] ? valueForCell(field, records[rowIndex]) : null)),
  };
}

export function clipboardText(clipboard: MorfraClipboard, fields: FieldSummary[]): string {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  return clipboard.values.map((row) => row.map((value, index) => displayValue(fieldMap.get(clipboard.fieldIds[index]), value)).join("\t")).join("\n");
}

export function serializeMorfraClipboard(clipboard: MorfraClipboard): string {
  return JSON.stringify(clipboard);
}

export function parseMorfraClipboard(value: string): MorfraClipboard | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isClipboard(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function rangeRows(selection: GridSelection): number[] {
  const bounds = rangeBounds(selection.range);
  return Array.from({ length: bounds.bottom - bounds.top + 1 }, (_, index) => bounds.top + index);
}

function rangeColumns(selection: GridSelection): number[] {
  const bounds = rangeBounds(selection.range);
  return Array.from({ length: bounds.right - bounds.left + 1 }, (_, index) => bounds.left + index);
}

function displayValue(field: FieldSummary | undefined, value: JsonValue): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    const names = new Map(field?.options.map((option) => [option.id, option.name]));
    return value.map((item) => typeof item === "string" ? names.get(item) ?? item : String(item)).join(", ");
  }
  if (typeof value === "boolean") return value ? "已勾选" : "未勾选";
  return String(value);
}

function isClipboard(value: unknown): value is MorfraClipboard {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  return source.version === 1 && Array.isArray(source.fieldIds) && source.fieldIds.every((id) => typeof id === "string") && Array.isArray(source.values) && source.values.every(Array.isArray);
}

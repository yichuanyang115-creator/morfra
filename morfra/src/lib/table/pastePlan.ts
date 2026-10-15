import type { StorageCellUpdate, StorageNewRecord } from "../ipc/storageClient";
import type { FieldSummary, JsonValue, TableDataSnapshot } from "../../types/domain";
import { isReadOnlyField } from "../../components/table/cellValue";
import { rangeBounds, type GridSelection } from "./selectionModel";
import { parseTsv, type MorfraClipboard } from "./clipboard";

export interface PastePlan {
  updates: StorageCellUpdate[];
  newRecords: StorageNewRecord[];
}

export function buildPastePlan(data: TableDataSnapshot, fields: FieldSummary[], selection: GridSelection, source: string[][] | MorfraClipboard): PastePlan | Error {
  const matrix = Array.isArray(source) ? source : source.values;
  if (!matrix.length || !matrix[0]?.length) return new Error("剪贴板没有可粘贴的值。");
  if (matrix.some((row) => row.length !== matrix[0].length)) return new Error("剪贴板内容不是规则的矩形区域。");
  const bounds = selection.rows.length ? { top: Math.min(...selection.rows), bottom: Math.max(...selection.rows), left: selection.active.column, right: selection.active.column } : rangeBounds(selection.range);
  const scalar = matrix.length === 1 && matrix[0].length === 1;
  const targetRows = scalar ? Array.from({ length: bounds.bottom - bounds.top + 1 }, (_, index) => bounds.top + index) : Array.from({ length: matrix.length }, (_, index) => selection.active.row + index);
  const targetColumns = scalar ? Array.from({ length: bounds.right - bounds.left + 1 }, (_, index) => bounds.left + index) : Array.from({ length: matrix[0].length }, (_, index) => selection.active.column + index);
  if (targetColumns.some((column) => !fields[column])) return new Error("粘贴内容超出了当前可见字段范围。");

  const errors: string[] = [];
  const updates: StorageCellUpdate[] = [];
  const created = new Map<number, Record<string, JsonValue>>();
  for (const rowIndex of targetRows) {
    for (const columnIndex of targetColumns) {
      const field = fields[columnIndex];
      if (!field) continue;
      if (isReadOnlyField(field)) { errors.push(`${field.name} 是只读字段`); continue; }
      const sourceRow = scalar ? 0 : rowIndex - selection.active.row;
      const sourceColumn = scalar ? 0 : columnIndex - selection.active.column;
      const value = normalizePastedValue(field, matrix[sourceRow]?.[sourceColumn]);
      if (value instanceof Error) { errors.push(`${field.name}：${value.message}`); continue; }
      const record = data.records[rowIndex];
      if (record) updates.push({ recordId: record.id, fieldId: field.id, value });
      else {
        const values = created.get(rowIndex) ?? {};
        values[field.id] = value;
        created.set(rowIndex, values);
      }
    }
  }
  const titleField = data.fields.find((field) => field.isTitle);
  for (const [rowIndex, values] of created) {
    if (!titleField || typeof values[titleField.id] !== "string" || !values[titleField.id]) errors.push(`新增第 ${rowIndex + 1} 行缺少主标题`);
  }
  if (errors.length) return new Error(`粘贴未执行：${[...new Set(errors)].join("；")}`);
  return { updates, newRecords: [...created.values()].map((values) => ({ values })) };
}

export function buildClearPlan(data: TableDataSnapshot, fields: FieldSummary[], selection: GridSelection): PastePlan | Error {
  const rows = selection.rows.length ? selection.rows : Array.from({ length: rangeBounds(selection.range).bottom - rangeBounds(selection.range).top + 1 }, (_, index) => rangeBounds(selection.range).top + index);
  const columns = selection.rows.length ? fields.map((_, index) => index) : Array.from({ length: rangeBounds(selection.range).right - rangeBounds(selection.range).left + 1 }, (_, index) => rangeBounds(selection.range).left + index);
  const updates: StorageCellUpdate[] = [];
  for (const rowIndex of rows) for (const columnIndex of columns) {
    const record = data.records[rowIndex];
    const field = fields[columnIndex];
    if (!record || !field || isReadOnlyField(field)) continue;
    updates.push({ recordId: record.id, fieldId: field.id, value: field.fieldType === "multi_select" ? [] : null });
  }
  return updates.length ? { updates, newRecords: [] } : new Error("当前选区没有可清空的单元格。");
}

export function externalPastePlan(data: TableDataSnapshot, fields: FieldSummary[], selection: GridSelection, text: string): PastePlan | Error {
  return buildPastePlan(data, fields, selection, parseTsv(text));
}

function normalizePastedValue(field: FieldSummary, raw: JsonValue | undefined): JsonValue | Error {
  if (raw === null || raw === undefined || raw === "") return field.fieldType === "multi_select" ? [] : null;
  if (typeof raw !== "string") {
    if ((field.fieldType === "number" || field.fieldType === "progress") && typeof raw === "number" && Number.isFinite(raw)) {
      return field.fieldType === "progress" && (raw < 0 || raw > 100) ? new Error("进度必须介于 0 到 100") : raw;
    }
    if (field.fieldType === "checkbox" && typeof raw === "boolean") return raw;
    if (field.fieldType === "multi_select" && Array.isArray(raw)) {
      const valid = raw.every((item): item is string => typeof item === "string" && field.options.some((option) => option.id === item));
      return valid ? [...new Set(raw)] : new Error("包含不属于当前字段的选项");
    }
    return new Error("值与目标字段类型不匹配");
  }
  const value = raw.trim();
  if (["text", "image", "file", "link", "date"].includes(field.fieldType)) return value || null;
  if (field.fieldType === "number" || field.fieldType === "progress") {
    const number = Number(value);
    if (!Number.isFinite(number)) return new Error("需要有效数字");
    if (field.fieldType === "progress" && (number < 0 || number > 100)) return new Error("进度必须介于 0 到 100");
    return number;
  }
  if (field.fieldType === "checkbox") {
    if (["true", "1", "已勾选", "是"].includes(value.toLowerCase())) return true;
    if (["false", "0", "未勾选", "否"].includes(value.toLowerCase())) return false;
    return new Error("复选框只能粘贴已勾选或未勾选");
  }
  const options = new Map(field.options.flatMap((option) => [[option.id, option.id], [option.name, option.id]]));
  if (field.fieldType === "select") return options.get(value) ?? new Error("选项不属于当前字段");
  if (field.fieldType === "multi_select") {
    const selected = value.split(/[,，]/).map((item) => item.trim()).filter(Boolean).map((item) => options.get(item));
    return selected.every((item): item is string => Boolean(item)) ? [...new Set(selected)] : new Error("包含不属于当前字段的选项");
  }
  return new Error("该字段不可粘贴");
}

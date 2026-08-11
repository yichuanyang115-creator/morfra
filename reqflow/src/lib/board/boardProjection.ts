import type { FieldSummary, JsonValue, RecordData } from "../../types/domain";
import { valueForCell } from "../../components/table/cellValue";
import { stableSort, type ViewPipelineConfig } from "../table/viewPipeline";

export const EMPTY_BOARD_CONFIG: BoardViewConfig = {
  groupFieldId: null,
  fieldIds: [],
  columnOrder: [],
  collapsedKeys: [],
  cardPositions: {},
};

export interface BoardViewConfig {
  groupFieldId: string | null;
  fieldIds: string[];
  columnOrder: string[];
  collapsedKeys: string[];
  cardPositions: Record<string, string[]>;
}

export interface BoardColumn {
  key: string;
  label: string;
  recordIds: string[];
  count: number;
}

export function parseBoardConfig(value: JsonValue | undefined, fields: FieldSummary[]): BoardViewConfig {
  const source = isObject(value) ? value : {};
  const groupable = fields.filter((field) => !field.isTitle);
  const requestedGroup = typeof source.groupFieldId === "string" ? source.groupFieldId : null;
  const groupFieldId = groupable.some((field) => field.id === requestedGroup) ? requestedGroup : groupable[0]?.id ?? null;
  const knownIds = new Set(groupable.map((field) => field.id));
  const fieldIds = uniqueStrings(source.fieldIds).filter((id) => knownIds.has(id));
  const columnOrder = uniqueStrings(source.columnOrder);
  const collapsedKeys = uniqueStrings(source.collapsedKeys);
  const cardPositions = isObject(source.cardPositions) ? Object.fromEntries(Object.entries(source.cardPositions).map(([key, ids]) => [key, uniqueStrings(ids)])) : {};
  return { groupFieldId, fieldIds, columnOrder, collapsedKeys, cardPositions };
}

export function buildBoardColumns(records: RecordData[], fields: FieldSummary[], config: BoardViewConfig, pipeline: ViewPipelineConfig): BoardColumn[] {
  const groupField = fields.find((field) => field.id === config.groupFieldId && !field.isTitle);
  if (!groupField) return [];
  const columns = new Map<string, BoardColumn>();
  const add = (key: string, record: RecordData) => {
    const column = columns.get(key) ?? { key, label: labelFor(key, groupField), recordIds: [], count: 0 };
    column.recordIds.push(record.id);
    column.count += 1;
    columns.set(key, column);
  };
  if (groupField.fieldType === "select" || groupField.fieldType === "multi_select") {
    for (const option of groupField.options) columns.set(option.id, { key: option.id, label: option.name, recordIds: [], count: 0 });
  }
  for (const record of stableSort(records, fields, pipeline.sorts)) {
    const value = valueForCell(groupField, record);
    const keys = groupField.fieldType === "multi_select" && Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [value === null || value === "" ? "__empty__" : String(value)];
    for (const key of keys.length ? keys : ["__empty__"]) add(key, record);
  }
  if (!columns.has("__empty__")) columns.set("__empty__", { key: "__empty__", label: "未分组", recordIds: [], count: 0 });
  const defaultKeys = [...columns.keys()].filter((key) => key !== "__empty__");
  const orderedKeys = [...config.columnOrder.filter((key) => columns.has(key) && key !== "__empty__"), ...defaultKeys.filter((key) => !config.columnOrder.includes(key)), "__empty__"];
  return orderedKeys.map((key) => {
    const column = columns.get(key)!;
    if (pipeline.sorts.length > 0) return column;
    const manual = config.cardPositions[key] ?? [];
    const known = new Set(column.recordIds);
    const recordIds = [...manual.filter((id) => known.has(id)), ...column.recordIds.filter((id) => !manual.includes(id))];
    return { ...column, recordIds };
  });
}

export function moveCardValue(record: RecordData, field: FieldSummary, sourceKey: string, targetKey: string): JsonValue | null {
  if (["auto_number", "created_time", "updated_time"].includes(field.fieldType)) return null;
  if (field.fieldType === "multi_select") {
    const current = valueForCell(field, record);
    const values = Array.isArray(current) ? current.filter((item): item is string => typeof item === "string") : [];
    const withoutSource = values.filter((id) => id !== sourceKey);
    return targetKey === "__empty__" ? [] : [...new Set([...withoutSource, targetKey])];
  }
  if (field.fieldType === "checkbox") return targetKey === "true";
  if (field.fieldType === "number" || field.fieldType === "progress") return targetKey === "__empty__" ? null : Number(targetKey);
  return targetKey === "__empty__" ? null : targetKey;
}

export function removeCardFromColumnValue(record: RecordData, field: FieldSummary, sourceKey: string): JsonValue | null {
  if (["auto_number", "created_time", "updated_time"].includes(field.fieldType)) return null;
  if (field.fieldType === "multi_select") return (valueForCell(field, record) as string[]).filter((id) => id !== sourceKey);
  return null;
}

function labelFor(key: string, field: FieldSummary): string {
  if (key === "__empty__") return "未分组";
  if (field.fieldType === "select" || field.fieldType === "multi_select") return field.options.find((option) => option.id === key)?.name ?? key;
  if (field.fieldType === "checkbox") return key === "true" ? "已勾选" : "未勾选";
  return key;
}
function isObject(value: JsonValue | undefined): value is Record<string, JsonValue> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function uniqueStrings(value: JsonValue | undefined): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : []; }

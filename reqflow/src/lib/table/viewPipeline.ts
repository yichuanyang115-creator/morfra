import type { FieldSummary, JsonValue, RecordData, TableDataSnapshot } from "../../types/domain";
import { buildGroupProjection, type ProjectedGroup } from "./groupProjection";
import { formatUserValue } from "./fieldFormatting";

export type FilterOperator = "contains" | "notContains" | "equals" | "notEquals" | "isEmpty" | "isNotEmpty" | "greaterThan" | "greaterOrEqual" | "lessThan" | "lessOrEqual" | "between" | "before" | "after" | "on" | "dateBetween" | "isChecked" | "isUnchecked" | "hasFiles" | "fileNameContains" | "fileCountEquals" | "fileCountGreaterThan" | "fileCountLessThan";
export interface ViewFilter { id: string; fieldId: string; operator: FilterOperator; value?: JsonValue; }
export interface ViewSort { id: string; fieldId: string; direction: "asc" | "desc"; }
export interface ViewGroup { fieldId: string | null; direction: "asc" | "desc"; collapsedKeys: string[]; }
export interface ConditionalColorRule { id: string; fieldId: string; operator: FilterOperator; value?: JsonValue; color: "gray" | "blue" | "green" | "yellow" | "red" | "purple"; enabled: boolean; }
export interface ViewPipelineConfig { filters: ViewFilter[]; filterMode: "all"; sorts: ViewSort[]; group: ViewGroup; conditionalColors: ConditionalColorRule[]; }
export interface RecordGroupMeta { key: string; label: string; count: number; first: boolean; last: boolean; collapsed?: boolean; }
export interface ViewPipelineResult { records: RecordData[]; recordGroups: RecordGroupMeta[]; groups: ProjectedGroup[]; total: number; matched: number; }

export const EMPTY_VIEW_PIPELINE: ViewPipelineConfig = { filters: [], filterMode: "all", sorts: [], group: { fieldId: null, direction: "asc", collapsedKeys: [] }, conditionalColors: [] };

const SEARCH_INDEX = new WeakMap<TableDataSnapshot, Map<RecordData, string>>();

export function parseViewPipelineConfig(value: JsonValue): ViewPipelineConfig {
  const source = isObject(value) ? value : {};
  const filters = Array.isArray(source.filters) ? source.filters.flatMap(parseFilter) : [];
  const sorts = Array.isArray(source.sorts) ? source.sorts.flatMap(parseSort) : [];
  const groupSource = isObject(source.group) ? source.group : {};
  const rules = Array.isArray(source.conditionalColors) ? source.conditionalColors.flatMap(parseRule) : [];
  return {
    filters,
    // v3 只保留“同时满足”。历史 `any` 配置在读取时不会继续参与计算。
    filterMode: "all",
    sorts,
    group: { fieldId: typeof groupSource.fieldId === "string" ? groupSource.fieldId : null, direction: groupSource.direction === "desc" ? "desc" : "asc", collapsedKeys: Array.isArray(groupSource.collapsedKeys) ? groupSource.collapsedKeys.filter((key): key is string => typeof key === "string") : [] },
    conditionalColors: rules,
  };
}

export function runViewPipeline(data: TableDataSnapshot, config: ViewPipelineConfig, search: string): ViewPipelineResult {
  const searchedTerms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const searchIndex = searchedTerms.length ? searchableTextIndex(data) : null;
  const filters = config.filters.filter((filter) => isCompleteFilter(filter, data.fields));
  const sorts = config.sorts.filter((sort, index, all) => isSortableField(fieldsById(data.fields, sort.fieldId)) && all.findIndex((item) => item.fieldId === sort.fieldId) === index);
  const filtered = data.records.filter((record) => matchesFilters(record, data.fields, filters) && (!searchIndex || searchedTerms.every((term) => searchIndex.get(record)?.includes(term))));
  const groupField = data.fields.find((field) => field.id === config.group.fieldId);
  if (!groupField) return { records: stableSort(filtered, data.fields, sorts), recordGroups: [], groups: [], total: data.records.length, matched: filtered.length };
  const groups = buildGroupProjection(filtered, groupField, config.group.direction);
  const byId = new Map(filtered.map((record) => [record.id, record]));
  const records: RecordData[] = [];
  const recordGroups: RecordGroupMeta[] = [];
  for (const group of groups) {
    const collapsed = config.group.collapsedKeys.includes("__all__") || config.group.collapsedKeys.includes(group.key);
    const groupRecords = stableSort(group.recordIds.map((id) => byId.get(id)).filter((record): record is RecordData => Boolean(record)), data.fields, sorts);
    if (collapsed) {
      const anchor = groupRecords[0];
      if (anchor) { records.push(anchor); recordGroups.push({ key: group.key, label: group.label, count: group.count, first: true, last: true, collapsed: true }); }
      continue;
    }
    groupRecords.forEach((record, index) => { records.push(record); recordGroups.push({ key: group.key, label: group.label, count: group.count, first: index === 0, last: index === groupRecords.length - 1 }); });
  }
  return { records, recordGroups, groups, total: data.records.length, matched: filtered.length };
}

function searchableTextIndex(data: TableDataSnapshot): Map<RecordData, string> {
  const cached = SEARCH_INDEX.get(data);
  if (cached?.size === data.records.length) return cached;
  const index = new Map(data.records.map((record) => [record, searchableText(record, data.fields)]));
  SEARCH_INDEX.set(data, index);
  return index;
}

export function matchesFilters(record: RecordData, fields: FieldSummary[], filters: ViewFilter[]): boolean {
  if (!filters.length) return true;
  const matches = filters.map((filter) => {
    const field = fields.find((item) => item.id === filter.fieldId);
    return field ? matchesCondition(valueFor(record, field), filter.operator, filter.value) : false;
  });
  return matches.every(Boolean);
}

export function isCompleteCondition(condition: Pick<ViewFilter, "fieldId" | "operator" | "value">, fields: FieldSummary[]): boolean {
  if (!fields.some((field) => field.id === condition.fieldId)) return false;
  if (["isEmpty", "isNotEmpty", "isChecked", "isUnchecked", "hasFiles"].includes(condition.operator)) return true;
  if (Array.isArray(condition.value)) return condition.value.length > 0 && condition.value.every((value) => value !== null && value !== "");
  return condition.value !== undefined && condition.value !== null && String(condition.value).trim() !== "";
}

export function isCompleteFilter(condition: Pick<ViewFilter, "fieldId" | "operator" | "value">, fields: FieldSummary[]): boolean {
  const field = fields.find((item) => item.id === condition.fieldId);
  return Boolean(field && filterOperatorsFor(field).includes(condition.operator) && isCompleteCondition(condition, fields));
}

export function filterOperatorsFor(field?: FieldSummary): FilterOperator[] {
  if (!field) return [];
  if (field.fieldType === "checkbox") return ["isChecked", "isUnchecked"];
  if (["number", "progress", "auto_number"].includes(field.fieldType)) return ["equals", "notEquals", "greaterThan", "lessThan", "isEmpty", "isNotEmpty"];
  if (["date", "created_time", "updated_time"].includes(field.fieldType)) return ["equals", "notEquals", "before", "after", "isEmpty", "isNotEmpty"];
  if (field.fieldType === "select") return ["equals", "notEquals", "isEmpty", "isNotEmpty"];
  if (field.fieldType === "multi_select") return ["contains", "notContains", "isEmpty", "isNotEmpty"];
  if (["image", "file"].includes(field.fieldType)) return [];
  return ["contains", "notContains", "equals", "notEquals", "isEmpty", "isNotEmpty"];
}

export function isSortableField(field: FieldSummary | undefined): boolean {
  return Boolean(field && !["image", "file", "link"].includes(field.fieldType));
}

export function matchesCondition(value: JsonValue, operator: FilterOperator, expected?: JsonValue): boolean {
  const empty = value === null || value === "" || (Array.isArray(value) && value.length === 0);
  if (operator === "isEmpty") return empty;
  if (operator === "isNotEmpty") return !empty;
  if (operator === "isChecked") return value === true;
  if (operator === "isUnchecked") return value !== true;
  if (operator === "hasFiles") return !empty;
  if (operator === "fileCountEquals") return attachmentCount(value) === Number(expected);
  if (operator === "fileCountGreaterThan") return attachmentCount(value) > Number(expected);
  if (operator === "fileCountLessThan") return attachmentCount(value) < Number(expected);
  const values = Array.isArray(value) ? value.map(String) : [String(value ?? "")];
  const target = String(expected ?? "");
  if (operator === "contains") return values.some((item) => item.toLocaleLowerCase().includes(target.toLocaleLowerCase()));
  if (operator === "notContains") return values.every((item) => !item.toLocaleLowerCase().includes(target.toLocaleLowerCase()));
  if (operator === "fileNameContains") return values.some((item) => fileName(item).toLocaleLowerCase().includes(target.toLocaleLowerCase()));
  if (operator === "equals") return values.some((item) => item === target);
  if (operator === "notEquals") return values.every((item) => item !== target);
  if (operator === "on") return String(value ?? "").slice(0, 10) === target.slice(0, 10);
  if (operator === "between" || operator === "dateBetween") { const [minimum, maximum] = rangeValues(expected); const current = comparable(value); return current >= comparable(minimum) && current <= comparable(maximum); }
  const left = comparable(value);
  const right = comparable(expected ?? null);
  if (operator === "greaterThan" || operator === "after") return left > right;
  if (operator === "greaterOrEqual") return left >= right;
  if (operator === "lessOrEqual") return left <= right;
  return left < right;
}

export function searchableText(record: RecordData, fields: FieldSummary[]): string {
  return fields.flatMap((field) => {
    const value = valueFor(record, field);
    if (field.fieldType === "select" && typeof value === "string") return [field.options.find((option) => option.id === value)?.name ?? value];
    if (field.fieldType === "multi_select" && Array.isArray(value)) return value.map((id) => field.options.find((option) => option.id === id)?.name ?? id);
    if (["number", "progress", "auto_number", "date", "created_time", "updated_time"].includes(field.fieldType)) return [String(value ?? ""), formatUserValue(field, value)];
    if (["file", "image"].includes(field.fieldType)) return [String(value ?? ""), ...attachmentValues(value).map(fileName)];
    if (field.fieldType === "link") return [String(value ?? ""), decodeLinkText(String(value ?? ""))];
    return [String(value ?? "")];
  }).join(" ").toLocaleLowerCase();
}

export function stableSort(records: RecordData[], fields: FieldSummary[], sorts: ViewSort[]): RecordData[] {
  return records.map((record, index) => ({ record, index })).sort((left, right) => {
    for (const sort of sorts) {
      const field = fields.find((item) => item.id === sort.fieldId);
      if (!field) continue;
      const leftValue = valueFor(left.record, field);
      const rightValue = valueFor(right.record, field);
      const emptyResult = compareEmptyValues(leftValue, rightValue);
      if (emptyResult) return emptyResult;
      const result = compareValues(leftValue, rightValue, field);
      if (result) return sort.direction === "desc" ? -result : result;
    }
    return left.record.position - right.record.position || left.index - right.index;
  }).map(({ record }) => record);
}

export function groupKey(record: RecordData, field: FieldSummary): string {
  const value = valueFor(record, field);
  if (Array.isArray(value)) return value.length ? value.join("|") : "__empty__";
  return value === null || value === "" ? "__empty__" : String(value);
}

function valueFor(record: RecordData, field: FieldSummary): JsonValue { if (field.fieldType === "auto_number") return record.autoNumber; if (field.fieldType === "created_time") return record.createdAt || record.values[field.id] || null; if (field.fieldType === "updated_time") return record.updatedAt || record.values[field.id] || null; return field.fieldType === "multi_select" ? record.multiSelectValues[field.id] ?? [] : record.values[field.id] ?? null; }
function fieldsById(fields: FieldSummary[], fieldId: string): FieldSummary | undefined { return fields.find((field) => field.id === fieldId); }
function comparable(value: JsonValue): number | string { if (typeof value === "number") return value; const numeric = Number(value); return Number.isFinite(numeric) && String(value).trim() !== "" ? numeric : String(value ?? "").toLocaleLowerCase(); }
function rangeValues(value: JsonValue | undefined): [JsonValue, JsonValue] { if (Array.isArray(value)) return [value[0] ?? null, value[1] ?? null]; const [minimum = "", maximum = ""] = String(value ?? "").split(".."); return [minimum, maximum]; }
function fileName(value: string): string { try { return decodeURIComponent(new URL(value).pathname.split("/").pop() ?? value); } catch { return value.split("/").pop() ?? value; } }
function compareValues(left: JsonValue, right: JsonValue, field: FieldSummary): number { if (field.fieldType === "select" || field.fieldType === "multi_select") { const optionIndex = new Map(field.options.map((option) => [option.id, option.position])); return String(Array.isArray(left) ? left.map((item) => optionIndex.get(String(item)) ?? Number.MAX_SAFE_INTEGER).join(",") : optionIndex.get(String(left)) ?? Number.MAX_SAFE_INTEGER).localeCompare(String(Array.isArray(right) ? right.map((item) => optionIndex.get(String(item)) ?? Number.MAX_SAFE_INTEGER).join(",") : optionIndex.get(String(right)) ?? Number.MAX_SAFE_INTEGER)); } if (field.fieldType === "file" || field.fieldType === "image") { const count = attachmentCount(left) - attachmentCount(right); return count || (attachmentValues(left)[0] ?? "").localeCompare(attachmentValues(right)[0] ?? "", undefined, { numeric: true }); } return String(comparable(left)).localeCompare(String(comparable(right)), undefined, { numeric: true }); }
function compareEmptyValues(left: JsonValue, right: JsonValue): number { const leftEmpty = left === null || left === "" || (Array.isArray(left) && left.length === 0); const rightEmpty = right === null || right === "" || (Array.isArray(right) && right.length === 0); return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1; }
function parseFilter(value: JsonValue): ViewFilter[] { if (!isObject(value) || typeof value.id !== "string" || typeof value.fieldId !== "string" || !isOperator(value.operator)) return []; return [{ id: value.id, fieldId: value.fieldId, operator: value.operator, ...(value.value === undefined ? {} : { value: value.value }) }]; }
function parseSort(value: JsonValue): ViewSort[] { return isObject(value) && typeof value.id === "string" && typeof value.fieldId === "string" ? [{ id: value.id, fieldId: value.fieldId, direction: value.direction === "desc" ? "desc" : "asc" }] : []; }
function parseRule(value: JsonValue): ConditionalColorRule[] { if (!isObject(value) || typeof value.id !== "string" || typeof value.fieldId !== "string" || !isOperator(value.operator) || !isColor(value.color)) return []; return [{ id: value.id, fieldId: value.fieldId, operator: value.operator, ...(value.value === undefined ? {} : { value: value.value }), color: value.color, enabled: value.enabled !== false }]; }
function isObject(value: JsonValue): value is Record<string, JsonValue> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isOperator(value: JsonValue): value is FilterOperator { return typeof value === "string" && ["contains", "notContains", "equals", "notEquals", "isEmpty", "isNotEmpty", "greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual", "between", "before", "after", "on", "dateBetween", "isChecked", "isUnchecked", "hasFiles", "fileNameContains", "fileCountEquals", "fileCountGreaterThan", "fileCountLessThan"].includes(value); }
function attachmentValues(value: JsonValue): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : typeof value === "string" && value ? [value] : []; }
function attachmentCount(value: JsonValue): number { return attachmentValues(value).length; }
function decodeLinkText(value: string): string { const markdown = value.match(/^\[([^\]]+)]\(([^)]+)\)$/); if (markdown) return `${markdown[1]} ${markdown[2]}`; try { return decodeURIComponent(new URL(value).href); } catch { return value; } }
function isColor(value: JsonValue): value is ConditionalColorRule["color"] { return typeof value === "string" && ["gray", "blue", "green", "yellow", "red", "purple"].includes(value); }

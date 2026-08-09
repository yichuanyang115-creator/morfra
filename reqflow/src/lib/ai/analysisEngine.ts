import type { AIAnalysisFilter, AIAnalysisPlan, AIPrimitive } from "../../types/ai";
import {
  ANALYSIS_PLAN_LIMITS,
  validateAnalysisPlan,
  type AnalysisPlanIssue,
} from "./analysisPlan";
import type { TableCellValue, TableField, TableSnapshot } from "./tableSnapshot";

export interface AnalysisAggregateResult {
  id: string;
  operation: AIAnalysisPlan["aggregates"][number]["operation"];
  fieldId?: string;
  value: number | null;
  contributingRecordIds: string[];
  status: "computed" | "insufficient-data";
  numerator?: number;
  denominator?: number;
}

export interface AnalysisGroupResult {
  key: string;
  label: string;
  recordIds: string[];
  count: number;
}

export interface AnalysisRow {
  recordId: string;
  values: Record<string, TableCellValue>;
}

export interface AnalysisResult {
  tableId: string;
  scopeRecordIds: string[];
  matchingRecordIds: string[];
  filteredCount: number;
  rows: AnalysisRow[];
  groups: AnalysisGroupResult[];
  aggregates: AnalysisAggregateResult[];
}

export type AnalysisExecutionResult =
  | { ok: true; result: AnalysisResult }
  | { ok: false; code: "invalid-analysis-plan"; issues: AnalysisPlanIssue[] };

function isEmpty(value: TableCellValue): boolean {
  return value === null || value === "" || Array.isArray(value) && value.length === 0;
}

function dateComparable(value: string): number | null {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(value);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function sameValue(left: TableCellValue, right: AIPrimitive | AIPrimitive[], fieldType?: TableField["type"]): boolean {
  if (fieldType === "date" && typeof left === "string" && typeof right === "string") {
    const leftTime = dateComparable(left);
    const rightTime = dateComparable(right);
    return leftTime !== null && rightTime !== null && leftTime === rightTime;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

function compareValue(left: TableCellValue, right: AIPrimitive, fieldType?: TableField["type"]): number | null {
  if (fieldType === "date" && typeof left === "string" && typeof right === "string") {
    const leftTime = dateComparable(left);
    const rightTime = dateComparable(right);
    if (leftTime === null || rightTime === null) return null;
    return leftTime === rightTime ? 0 : leftTime < rightTime ? -1 : 1;
  }
  if (left === null || Array.isArray(left) || typeof right === "object" || right === null) return null;
  if (typeof left !== typeof right) return null;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function matchesFilter(
  recordValue: TableCellValue,
  filter: AIAnalysisFilter,
  field: TableField,
): boolean {
  switch (filter.operator) {
    case "isEmpty":
      return isEmpty(recordValue);
    case "isNotEmpty":
      return !isEmpty(recordValue);
    case "equals":
      return sameValue(recordValue, filter.value ?? null, field.type);
    case "notEquals":
      return !sameValue(recordValue, filter.value ?? null, field.type);
    case "contains":
      if (Array.isArray(recordValue)) return typeof filter.value === "string" && recordValue.some((item) => item === filter.value);
      return typeof recordValue === "string" && typeof filter.value === "string" && recordValue.toLowerCase().includes(filter.value.toLowerCase());
    case "greaterThan":
    case "greaterThanOrEqual":
    case "lessThan":
    case "lessThanOrEqual": {
      const comparison = compareValue(recordValue, filter.value as AIPrimitive, field.type);
      if (comparison === null) return false;
      if (filter.operator === "greaterThan") return comparison > 0;
      if (filter.operator === "greaterThanOrEqual") return comparison >= 0;
      if (filter.operator === "lessThan") return comparison < 0;
      return comparison <= 0;
    }
  }
}

function sortValue(value: TableCellValue): string | number | boolean {
  if (value === null) return "";
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? item : item.name)).join("\u0000");
  return value;
}

function sortRecords(
  records: TableSnapshot["records"],
  plan: AIAnalysisPlan,
  fields: Map<string, TableField>,
): TableSnapshot["records"] {
  if (plan.sort.length === 0) return records;
  const sorted = [...records];
  sorted.sort((left, right) => {
    for (const rule of plan.sort) {
      const leftValue = sortValue(left.values[rule.fieldId]);
      const rightValue = sortValue(right.values[rule.fieldId]);
      const fieldType = fields.get(rule.fieldId)?.type;
      const comparison = fieldType === "date" && typeof leftValue === "string" && typeof rightValue === "string"
        ? compareValue(leftValue, rightValue, fieldType)
        : leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
      if (comparison !== 0 && comparison !== null) return rule.direction === "ascending" ? comparison : -comparison;
    }
    return left.id.localeCompare(right.id);
  });
  return sorted;
}

function fieldLabel(field: TableField, value: TableCellValue): string {
  if (value === null || value === "") return "空值";
  if (Array.isArray(value) && value.length === 0) return "空值";
  if (field.type === "singleSelect" && typeof value === "string") return field.options?.find((option) => option.id === value)?.label ?? value;
  if (field.type === "multiSelect" && typeof value === "string") return field.options?.find((option) => option.id === value)?.label ?? value;
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

function groupKeys(
  record: TableSnapshot["records"][number],
  fieldIds: string[],
  fields: Map<string, TableField>,
): Array<{ key: string; label: string }> {
  if (fieldIds.length === 0) return [];
  let groups = [{ key: "", label: "" }];
  for (const fieldId of fieldIds) {
    const field = fields.get(fieldId);
    if (!field) continue;
    const value = record.values[fieldId];
    const values: TableCellValue[] = field.type === "multiSelect" && Array.isArray(value) && value.length > 0
      ? [...(value as string[])]
      : [value];
    groups = groups.flatMap((group) => values.map((item) => ({
      key: `${group.key}${fieldId}=${JSON.stringify(item)};`,
      label: `${group.label}${group.label.length > 0 ? " / " : ""}${field.name}：${fieldLabel(field, item)}`,
    })));
  }
  return groups;
}

function aggregateResults(
  records: TableSnapshot["records"],
  plan: AIAnalysisPlan,
  scopeRecordCount: number,
): AnalysisAggregateResult[] {
  return plan.aggregates.map((aggregate) => {
    if (aggregate.operation === "count" && !aggregate.fieldId) {
      return { ...aggregate, value: records.length, contributingRecordIds: records.map((record) => record.id), status: "computed" as const };
    }
    const ids = records.filter((record) => !isEmpty(record.values[aggregate.fieldId ?? ""])).map((record) => record.id);
    if (aggregate.operation === "count") return { ...aggregate, value: ids.length, contributingRecordIds: ids, status: "computed" as const };
    if (aggregate.operation === "percentage") {
      const numerator = aggregate.fieldId ? ids.length : records.length;
      return {
        ...aggregate,
        value: scopeRecordCount === 0 ? null : numerator / scopeRecordCount * 100,
        contributingRecordIds: aggregate.fieldId ? ids : records.map((record) => record.id),
        status: scopeRecordCount === 0 ? "insufficient-data" as const : "computed" as const,
        numerator,
        denominator: scopeRecordCount,
      };
    }
    const values = records
      .map((record) => record.values[aggregate.fieldId ?? ""])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (values.length === 0) return { ...aggregate, value: null, contributingRecordIds: [], status: "insufficient-data" as const };
    const value = aggregate.operation === "sum"
      ? values.reduce((sum, item) => sum + item, 0)
      : aggregate.operation === "average"
        ? values.reduce((sum, item) => sum + item, 0) / values.length
        : aggregate.operation === "minimum"
          ? Math.min(...values)
          : Math.max(...values);
    return { ...aggregate, value, contributingRecordIds: ids, status: "computed" as const };
  });
}

export function executeAnalysisPlan(
  snapshot: TableSnapshot,
  rawPlan: unknown,
  options: { recordIds?: readonly string[] } = {},
): AnalysisExecutionResult {
  const validation = validateAnalysisPlan(rawPlan, snapshot, options);
  if (!validation.ok) return { ok: false, code: "invalid-analysis-plan", issues: validation.issues };

  const fields = new Map(snapshot.fields.map((field) => [field.id, field]));
  const scoped = snapshot.records.filter((record) => validation.recordIds.includes(record.id));
  const filtered = scoped.filter((record) => validation.plan.filters.every((filter) => {
    const field = fields.get(filter.fieldId);
    return field ? matchesFilter(record.values[filter.fieldId], filter, field) : false;
  }));
  const sorted = sortRecords(filtered, validation.plan, fields);
  const rowLimit = validation.plan.limit ?? ANALYSIS_PLAN_LIMITS.maxResultRows;
  const rows = sorted.slice(0, rowLimit).map((record) => ({
    recordId: record.id,
    values: Object.fromEntries(validation.plan.projections.map((fieldId) => [fieldId, record.values[fieldId]])),
  }));
  const grouped = new Map<string, AnalysisGroupResult>();
  for (const record of filtered) {
    for (const group of groupKeys(record, validation.plan.groupBy, fields)) {
      const existing = grouped.get(group.key);
      if (existing) {
        if (!existing.recordIds.includes(record.id)) existing.recordIds.push(record.id);
        existing.count = existing.recordIds.length;
      } else {
        grouped.set(group.key, { ...group, recordIds: [record.id], count: 1 });
      }
    }
  }
  return {
    ok: true,
    result: {
      tableId: snapshot.tableId,
      scopeRecordIds: validation.recordIds,
      matchingRecordIds: filtered.map((record) => record.id),
      filteredCount: filtered.length,
      rows,
      groups: [...grouped.values()],
      aggregates: aggregateResults(filtered, validation.plan, scoped.length),
    },
  };
}

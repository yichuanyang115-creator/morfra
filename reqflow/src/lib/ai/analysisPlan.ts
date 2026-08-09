import type {
  AIAnalysisAggregate,
  AIAnalysisFilter,
  AIAnalysisPlan,
  AIPrimitive,
} from "../../types/ai";
import type { TableField, TableSnapshot } from "./tableSnapshot";
import {
  fieldFor,
  hasOwn,
  isRecord,
  issue,
  nonEmptyString,
  rejectUnknownProperties,
  validateFieldIdArray,
  validateFilterValue,
} from "./analysisPlanHelpers";
export const ANALYSIS_PLAN_LIMITS = {
  maxFilters: 10,
  maxProjections: 20,
  maxGroups: 3,
  maxAggregates: 10,
  maxSortRules: 3,
  maxRecords: 1000,
  maxResultRows: 100,
} as const;
export type AnalysisPlanIssueCode =
  | "invalid-shape"
  | "unknown-property"
  | "missing-property"
  | "invalid-value"
  | "unknown-field"
  | "invalid-operation"
  | "invalid-option"
  | "invalid-record-range"
  | "result-too-large";
export interface AnalysisPlanIssue {
  code: AnalysisPlanIssueCode;
  path: string;
  message: string;
}
export interface AnalysisPlanValidationOptions {
  recordIds?: readonly string[];
}
export type AnalysisPlanValidationResult =
  | { ok: true; plan: AIAnalysisPlan; recordIds: string[] }
  | { ok: false; issues: AnalysisPlanIssue[] };
const PLAN_KEYS = new Set(["filters", "projections", "groupBy", "aggregates", "sort", "limit", "recordIds"]);
const FILTER_OPERATORS = new Set([
  "equals",
  "notEquals",
  "contains",
  "isEmpty",
  "isNotEmpty",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
]);
const AGGREGATE_OPERATIONS = new Set(["count", "percentage", "sum", "average", "minimum", "maximum"]);
const FILTER_KEYS = new Set(["fieldId", "operator", "value"]);
const AGGREGATE_KEYS = new Set(["id", "operation", "fieldId"]);
const SORT_KEYS = new Set(["fieldId", "direction"]);
function validateFilters(
  input: unknown,
  fields: Map<string, TableField>,
  issues: AnalysisPlanIssue[],
): AIAnalysisFilter[] {
  if (!Array.isArray(input)) {
    issue(issues, "invalid-shape", "filters", "必须是数组");
    return [];
  }
  if (input.length > ANALYSIS_PLAN_LIMITS.maxFilters) {
    issue(issues, "result-too-large", "filters", `最多允许 ${ANALYSIS_PLAN_LIMITS.maxFilters} 条`);
  }
  return input.flatMap((raw, index) => {
    const path = `filters[${index}]`;
    if (!isRecord(raw)) {
      issue(issues, "invalid-shape", path, "必须是对象");
      return [];
    }
    rejectUnknownProperties(raw, FILTER_KEYS, path, issues);
    const field = fieldFor(raw.fieldId, `${path}.fieldId`, fields, issues);
    const operator = raw.operator;
    if (typeof operator !== "string" || !FILTER_OPERATORS.has(operator)) {
      issue(issues, "invalid-operation", `${path}.operator`, "不是支持的筛选操作");
    }
    const value = raw.value as AIPrimitive | AIPrimitive[] | undefined;
    const operationAllowed = field && typeof operator === "string" && FILTER_OPERATORS.has(operator)
      ? validateFilterValue(field, operator, value, `${path}.operator`, issues)
      : false;
    if (!field || typeof operator !== "string" || !FILTER_OPERATORS.has(operator) || !operationAllowed) return [];
    return [{ fieldId: field.id, operator: operator as AIAnalysisFilter["operator"], ...(value === undefined ? {} : { value }) }];
  });
}
function validateAggregates(
  input: unknown,
  fields: Map<string, TableField>,
  issues: AnalysisPlanIssue[],
): AIAnalysisAggregate[] {
  if (!Array.isArray(input)) {
    issue(issues, "invalid-shape", "aggregates", "必须是数组");
    return [];
  }
  if (input.length > ANALYSIS_PLAN_LIMITS.maxAggregates) {
    issue(issues, "result-too-large", "aggregates", `最多允许 ${ANALYSIS_PLAN_LIMITS.maxAggregates} 项`);
  }
  const ids = new Set<string>();
  return input.flatMap((raw, index) => {
    const path = `aggregates[${index}]`;
    if (!isRecord(raw)) {
      issue(issues, "invalid-shape", path, "必须是对象");
      return [];
    }
    rejectUnknownProperties(raw, AGGREGATE_KEYS, path, issues);
    const id = raw.id;
    const operation = raw.operation;
    if (!nonEmptyString(id)) issue(issues, "invalid-value", `${path}.id`, "必须是非空字符串");
    else if (ids.has(id)) issue(issues, "invalid-value", `${path}.id`, "聚合 ID 不能重复");
    else ids.add(id);
    if (typeof operation !== "string" || !AGGREGATE_OPERATIONS.has(operation)) {
      issue(issues, "invalid-operation", `${path}.operation`, "不是支持的聚合操作");
    }
    const needsField = operation !== "count" && operation !== "percentage";
    const field = raw.fieldId === undefined && !needsField ? undefined : fieldFor(raw.fieldId, `${path}.fieldId`, fields, issues);
    if (field && (operation === "sum" || operation === "average" || operation === "minimum" || operation === "maximum") &&
      field.type !== "number" && field.type !== "percent") {
      issue(issues, "invalid-operation", `${path}.operation`, `${operation} 只支持 number 或 percent 字段`);
    }
    if (!nonEmptyString(id) || typeof operation !== "string" || !AGGREGATE_OPERATIONS.has(operation)) return [];
    return [{ id, operation: operation as AIAnalysisAggregate["operation"], ...(field ? { fieldId: field.id } : {}) }];
  });
}
export function validateAnalysisPlan(
  input: unknown,
  snapshot: TableSnapshot,
  options: AnalysisPlanValidationOptions = {},
): AnalysisPlanValidationResult {
  const issues: AnalysisPlanIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [{ code: "invalid-shape", path: "plan", message: "必须是对象" }] };
  for (const key of Object.keys(input)) {
    if (!PLAN_KEYS.has(key)) issue(issues, "unknown-property", key, "不是允许的计划字段");
  }
  const requiredKeys = ["filters", "projections", "groupBy", "aggregates", "sort", "limit"];
  for (const key of requiredKeys) if (!hasOwn(input, key)) issue(issues, "missing-property", key, "计划字段缺失");
  const fields = new Map(snapshot.fields.map((field) => [field.id, field]));
  const filters = validateFilters(input.filters, fields, issues);
  const projections = validateFieldIdArray(input.projections, "projections", ANALYSIS_PLAN_LIMITS.maxProjections, fields, issues);
  const groupBy = validateFieldIdArray(input.groupBy, "groupBy", ANALYSIS_PLAN_LIMITS.maxGroups, fields, issues);
  for (const fieldId of groupBy) {
    const type = fields.get(fieldId)?.type;
    if (type === "attachment" || type === "computed") issue(issues, "invalid-operation", "groupBy", `${type} 字段不能分组`);
  }
  const aggregates = validateAggregates(input.aggregates, fields, issues);
  const sort: AIAnalysisPlan["sort"] = [];
  if (!Array.isArray(input.sort)) issue(issues, "invalid-shape", "sort", "必须是数组");
  else {
    if (input.sort.length > ANALYSIS_PLAN_LIMITS.maxSortRules) issue(issues, "result-too-large", "sort", `最多允许 ${ANALYSIS_PLAN_LIMITS.maxSortRules} 条`);
    const sortFields = new Set<string>();
    input.sort.forEach((raw, index) => {
      const path = `sort[${index}]`;
      if (!isRecord(raw)) {
        issue(issues, "invalid-shape", path, "必须是对象");
        return;
      }
      rejectUnknownProperties(raw, SORT_KEYS, path, issues);
      const field = fieldFor(raw.fieldId, `${path}.fieldId`, fields, issues);
      const direction = raw.direction;
      if (direction !== "ascending" && direction !== "descending") issue(issues, "invalid-value", `${path}.direction`, "只能是 ascending 或 descending");
      const sortable = field?.type !== "attachment" && field?.type !== "computed";
      if (!sortable && field) issue(issues, "invalid-operation", `${path}.fieldId`, `${field.type} 字段不能排序`);
      if (field && sortable && !sortFields.has(field.id) && (direction === "ascending" || direction === "descending")) {
        sortFields.add(field.id);
        sort.push({ fieldId: field.id, direction });
      } else if (field && sortFields.has(field.id)) issue(issues, "invalid-value", `${path}.fieldId`, "排序字段不能重复");
    });
  }
  const limit = input.limit;
  if (limit !== null && (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > ANALYSIS_PLAN_LIMITS.maxResultRows)) {
    issue(issues, "result-too-large", "limit", `必须是 1-${ANALYSIS_PLAN_LIMITS.maxResultRows} 的整数或 null`);
  }
  const declaredRecordIdsInput = input.recordIds;
  if (declaredRecordIdsInput !== undefined && !Array.isArray(declaredRecordIdsInput)) {
    issue(issues, "invalid-record-range", "recordIds", "必须是数组");
  }
  const declaredRecordIds = Array.isArray(declaredRecordIdsInput) ? declaredRecordIdsInput : undefined;
  if (declaredRecordIds && declaredRecordIds.length === 0) issue(issues, "invalid-record-range", "recordIds", "记录范围不能为空");
  const scope: readonly unknown[] = options.recordIds ?? declaredRecordIds ?? snapshot.records.map((record) => record.id);
  const emptyScopeIsAllowed = snapshot.records.length === 0 && options.recordIds === undefined && declaredRecordIds === undefined;
  if (scope.length > ANALYSIS_PLAN_LIMITS.maxRecords || scope.length === 0 && !emptyScopeIsAllowed) {
    issue(issues, "invalid-record-range", "recordIds", "记录范围必须是 1-1000 条");
  }
  const snapshotRecordIds = new Set(snapshot.records.map((record) => record.id));
  const uniqueScope = new Set<string>();
  for (const [index, recordId] of scope.entries()) {
    if (!nonEmptyString(recordId) || !snapshotRecordIds.has(recordId)) {
      issue(issues, "invalid-record-range", `recordIds[${index}]`, "记录不存在");
      continue;
    }
    if (uniqueScope.has(recordId)) issue(issues, "invalid-record-range", `recordIds[${index}]`, "记录不能重复");
    uniqueScope.add(recordId);
  }
  if (options.recordIds && declaredRecordIds) {
    const allowed = new Set(options.recordIds);
    const declaredSeen = new Set<string>();
    for (const [index, recordId] of declaredRecordIds.entries()) {
      if (!nonEmptyString(recordId) || !snapshotRecordIds.has(recordId)) issue(issues, "invalid-record-range", `recordIds[${index}]`, "记录不存在");
      if (typeof recordId === "string" && declaredSeen.has(recordId)) issue(issues, "invalid-record-range", `recordIds[${index}]`, "记录不能重复");
      if (typeof recordId === "string") {
        declaredSeen.add(recordId);
        if (!allowed.has(recordId)) issue(issues, "invalid-record-range", "recordIds", "模型计划不能扩大用户指定的记录范围");
      }
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  const plan: AIAnalysisPlan = { filters, projections, groupBy, aggregates, sort, limit: limit as number | null };
  if (declaredRecordIds !== undefined) plan.recordIds = [...uniqueScope];
  return { ok: true, plan, recordIds: [...uniqueScope] };
}

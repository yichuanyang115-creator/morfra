import type { AnalysisPlanIssue, AnalysisPlanIssueCode } from "./analysisPlan";
import type { TableField } from "./tableSnapshot";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
export function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
export function issue(issues: AnalysisPlanIssue[], code: AnalysisPlanIssueCode, path: string, message: string): void {
  issues.push({ code, path, message });
}
export function rejectUnknownProperties(value: Record<string, unknown>, allowed: Set<string>, path: string, issues: AnalysisPlanIssue[]): void {
  for (const key of Object.keys(value)) if (!allowed.has(key)) issue(issues, "unknown-property", `${path}.${key}`, "不是允许的计划字段");
}
export function fieldFor(fieldId: unknown, path: string, fields: Map<string, TableField>, issues: AnalysisPlanIssue[]): TableField | undefined {
  if (!nonEmptyString(fieldId)) {
    issue(issues, "invalid-value", path, "必须是非空字段 ID");
    return undefined;
  }
  const field = fields.get(fieldId);
  if (!field) issue(issues, "unknown-field", path, `字段不存在：${fieldId}`);
  return field;
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isDateValue(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}
function filterOperatorAllowed(field: TableField, operator: string): boolean {
  if (operator === "isEmpty" || operator === "isNotEmpty") return true;
  const numeric = new Set(["greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"]);
  switch (field.type) {
    case "number":
    case "percent":
    case "date":
      return operator === "equals" || operator === "notEquals" || numeric.has(operator);
    case "text":
      return operator === "equals" || operator === "notEquals" || operator === "contains";
    case "computed":
      return operator === "equals" || operator === "notEquals";
    case "singleSelect":
      return operator === "equals" || operator === "notEquals";
    case "multiSelect":
      return operator === "equals" || operator === "notEquals" || operator === "contains";
    case "checkbox":
      return operator === "equals" || operator === "notEquals";
    case "attachment":
      return false;
  }
}
function validFilterValue(field: TableField, operator: string, value: unknown): boolean {
  if (operator === "isEmpty" || operator === "isNotEmpty") return value === undefined;
  if (value === undefined || Array.isArray(value) && value.length === 0) return false;
  switch (field.type) {
    case "text":
      return typeof value === "string";
    case "number":
    case "percent":
      return isFiniteNumber(value);
    case "date":
      return isDateValue(value);
    case "checkbox":
      return typeof value === "boolean";
    case "singleSelect":
      return typeof value === "string" && field.options?.some((option) => option.id === value) === true;
    case "multiSelect":
      if (operator === "contains") return typeof value === "string" && field.options?.some((option) => option.id === value) === true;
      return Array.isArray(value) && value.every((item) => typeof item === "string") && value.every((item) => field.options?.some((option) => option.id === item) === true);
    case "computed":
      return typeof value === "string" || typeof value === "boolean" || isFiniteNumber(value);
    case "attachment":
      return false;
  }
}
export function validateFieldIdArray(input: unknown, path: string, max: number, fields: Map<string, TableField>, issues: AnalysisPlanIssue[]): string[] {
  if (!Array.isArray(input)) {
    issue(issues, "invalid-shape", path, "必须是数组");
    return [];
  }
  if (input.length > max) issue(issues, "result-too-large", path, `最多允许 ${max} 项`);
  const ids: string[] = [];
  const seen = new Set<string>();
  input.forEach((value, index) => {
    const field = fieldFor(value, `${path}[${index}]`, fields, issues);
    if (!field || typeof value !== "string") return;
    if (seen.has(value)) issue(issues, "invalid-value", `${path}[${index}]`, "字段不能重复");
    seen.add(value);
    ids.push(field.id);
  });
  return ids;
}
export function validateFilterValue(field: TableField, operator: string, value: unknown, path: string, issues: AnalysisPlanIssue[]): boolean {
  const allowed = filterOperatorAllowed(field, operator);
  if (!allowed) issue(issues, "invalid-operation", path, `操作 ${operator} 不适用于字段类型 ${field.type}`);
  else if (!validFilterValue(field, operator, value)) issue(issues, "invalid-value", `${path.replace(/\.operator$/, ".value")}`, `值与字段类型 ${field.type} 或操作不匹配`);
  return allowed;
}

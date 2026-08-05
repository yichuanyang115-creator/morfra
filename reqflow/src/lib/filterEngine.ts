import type { Attribute, FilterCondition, FilterOperator } from "../types/schema";
import type { Requirement } from "../types/models";
import { stayDays as computeStayDays, totalDays as computeTotalDays } from "./requirementMetrics";

/** 运算符按属性类型（REQ-026："运算符按类型区分"——日期 = 之前 之后，含精确等号）。 */
export const FILTER_OPERATORS_BY_TYPE: Record<Attribute["type"], FilterOperator[]> = {
  singleSelect: ["eq", "neq", "is_empty", "is_not_empty"],
  multiSelect: ["contains", "not_contains"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte"],
  percent: ["eq", "neq", "gt", "gte", "lt", "lte"],
  date: ["eq", "before", "after"],
  text: ["contains", "not_contains"],
  checkbox: ["eq", "neq"],
  attachment: ["is_empty", "is_not_empty"],
  computed: [],
};

/** 某个属性当前可用的运算符（computed 按 computedKind 映射：createdAt→日期比较，天数字段→数字比较）。 */
export function operatorsFor(attribute: Attribute): FilterOperator[] {
  if (attribute.type === "computed") {
    return attribute.computedKind === "createdAt"
      ? ["eq", "before", "after"]
      : ["eq", "neq", "gt", "gte", "lt", "lte"];
  }
  return FILTER_OPERATORS_BY_TYPE[attribute.type];
}

/** 取实体的该属性实际值：computed 动态算（不存 attributeValues），其余读 attributeValues。 */
function valueOf(attribute: Attribute, requirement: Requirement): unknown {
  if (attribute.type === "computed") {
    switch (attribute.computedKind) {
      case "createdAt":
        return requirement.createdAt;
      case "stayDays":
        return computeStayDays(requirement);
      case "totalDays":
        return computeTotalDays(requirement);
      default:
        return undefined;
    }
  }
  return requirement.attributeValues[attribute.id];
}

function isEmptyValue(v: unknown): boolean {
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** 数字比较：任一侧取不到数字时该条件不满足（不筛掉未知值，视为不可比较）。 */
function numericCompare(actual: unknown, expected: unknown, op: (a: number, b: number) => boolean): boolean {
  const a = asNumber(actual);
  const b = asNumber(expected);
  if (a == null || b == null) return false;
  return op(a, b);
}

/** 日期比较：取 YYYY-MM-DD 前缀做字典序比较（ISO 日期前缀字典序=时间序）。 */
function dateCompare(actual: unknown, expected: unknown, op: (a: string, b: string) => boolean): boolean {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  return op(actual.slice(0, 10), expected.slice(0, 10));
}

function matches(actual: unknown, condition: FilterCondition): boolean {
  switch (condition.operator) {
    case "is_empty":
      return isEmptyValue(actual);
    case "is_not_empty":
      return !isEmptyValue(actual);
    case "eq":
      // 日期精确匹配：computed createdAt 的当前值是完整 ISO 串（形如 YYYY-MM-DDTHH:mm），
      // date input 值是 YYYY-MM-DD，按日期前缀比较才相等；普通 date 属性值本身存
      // YYYY-MM-DD，走严格相等。用 ISO 正则识别而非含 "T" 试探（避免任意含 T 字符串误入）。
      if (
        typeof actual === "string" &&
        typeof condition.value === "string" &&
        /^\d{4}-\d{2}-\d{2}T/.test(actual)
      ) {
        return actual.slice(0, 10) === condition.value.slice(0, 10);
      }
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "contains":
      if (Array.isArray(actual)) return actual.includes(condition.value);
      return typeof actual === "string" && actual.includes(String(condition.value));
    case "not_contains":
      if (Array.isArray(actual)) return !actual.includes(condition.value);
      return typeof actual === "string" && !actual.includes(String(condition.value));
    case "gt":
      return numericCompare(actual, condition.value, (a, b) => a > b);
    case "gte":
      return numericCompare(actual, condition.value, (a, b) => a >= b);
    case "lt":
      return numericCompare(actual, condition.value, (a, b) => a < b);
    case "lte":
      return numericCompare(actual, condition.value, (a, b) => a <= b);
    case "before":
      return dateCompare(actual, condition.value, (a, b) => a < b);
    case "after":
      return dateCompare(actual, condition.value, (a, b) => a > b);
  }
}

/**
 * 筛选求值（REQ-026）：多条件 AND，全部满足才可见。空条件列表返回 true（全量显示）。
 * 未完成的草稿条件（attributeId 为空）和指向已删除属性的条件被忽略，不参与筛选。
 */
export function requirementMatchesFilters(
  requirement: Requirement,
  attributes: Attribute[],
  filters: FilterCondition[],
): boolean {
  if (filters.length === 0) return true;
  const byId = new Map(attributes.map((a) => [a.id, a]));
  for (const condition of filters) {
    if (!condition.attributeId) continue;
    const attribute = byId.get(condition.attributeId);
    if (!attribute) continue;
    if (!matches(valueOf(attribute, requirement), condition)) return false;
  }
  return true;
}

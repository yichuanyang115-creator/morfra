import type { Attribute, SortDirection, SortRule, StageSortPreference } from "../types/schema";
import type { Requirement } from "../types/models";
import { diffDaysFromToday } from "./dates";
import { lastTransitionTimestamp } from "./requirementMetrics";

export type SortDir = SortDirection;

export interface EffectiveStageSort {
  mode: "rule" | "manual";
  rule: SortRule | null;
}

const EXCLUDED_SORT_TYPES = new Set<Attribute["type"]>(["text", "checkbox", "attachment"]);

export function sortableAttributes(attributes: Attribute[]): Attribute[] {
  return attributes.filter((attribute) => !EXCLUDED_SORT_TYPES.has(attribute.type));
}

export function defaultSortRule(attributes: Attribute[]): SortRule | null {
  const preferred = attributes.find((attribute) => attribute.id === "created_at" && !EXCLUDED_SORT_TYPES.has(attribute.type));
  return preferred ? { attrId: preferred.id, direction: "desc" } : null;
}

export function effectiveStageSort(
  stageId: string,
  globalSort: SortRule | null | undefined,
  stageSorts: Record<string, StageSortPreference> | undefined,
  attributes: Attribute[] = [],
): EffectiveStageSort {
  const local = stageSorts?.[stageId];
  if (local && "mode" in local && local.mode === "manual") return { mode: "manual", rule: null };
  if (local && "attrId" in local) return { mode: "rule", rule: local };
  return { mode: "rule", rule: globalSort ?? defaultSortRule(attributes) };
}

export function isSortRuleActive(rule: SortRule | null | undefined): boolean {
  return Boolean(rule?.attrId);
}

interface SortValue {
  value: string | number;
  empty: boolean;
}

function comparePrimitive(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function valueForAttribute(requirement: Requirement, attribute: Attribute): SortValue {
  if (attribute.type === "computed") {
    switch (attribute.computedKind) {
      case "createdAt":
        return { value: requirement.createdAt || "", empty: !requirement.createdAt };
      case "stayDays":
        return { value: diffDaysFromToday(lastTransitionTimestamp(requirement)) ?? -1, empty: !lastTransitionTimestamp(requirement) };
      case "totalDays":
        return { value: diffDaysFromToday(requirement.createdAt) ?? -1, empty: !requirement.createdAt };
      default:
        return { value: "", empty: true };
    }
  }

  const value = requirement.attributeValues[attribute.id];
  if (typeof value === "number") return { value, empty: false };
  if (typeof value === "string") {
    if (attribute.type === "singleSelect") {
      const index = attribute.options?.findIndex((option) => option.id === value) ?? -1;
      return { value: index < 0 ? 0 : index, empty: index < 0 };
    }
    return { value, empty: !value };
  }
  if (Array.isArray(value)) {
    const joined = value.join("\u0000");
    return { value: joined, empty: !joined };
  }
  return { value: "", empty: true };
}

function compareByRule(a: Requirement, b: Requirement, rule: SortRule, attributesById: Map<string, Attribute>): number {
  const attribute = attributesById.get(rule.attrId);
  if (!attribute) return 0;
  const left = valueForAttribute(a, attribute);
  const right = valueForAttribute(b, attribute);
  if (left.empty !== right.empty) return left.empty ? 1 : -1;
  const result = comparePrimitive(left.value, right.value);
  return rule.direction === "desc" ? -result : result;
}

function sortByManualOrder(requirements: Requirement[]): Requirement[] {
  return requirements.slice().sort((a, b) => a.manualOrder - b.manualOrder);
}

export function sortRequirementsForStage(
  requirements: Requirement[],
  sort: EffectiveStageSort,
  attributes: Attribute[],
): Requirement[] {
  if (sort.mode === "manual") return sortByManualOrder(requirements);
  if (!sort.rule) return requirements.slice();
  const attributesById = new Map(attributes.map((attribute) => [attribute.id, attribute]));
  return requirements.slice().sort((a, b) => compareByRule(a, b, sort.rule!, attributesById));
}

/** 拖拽后仅重写目标阶段实体的 manualOrder，其他阶段不受影响。 */
export function reorderManualOrder(orderedRequirements: Requirement[]): { requirementId: string; manualOrder: number }[] {
  return orderedRequirements.map((requirement, index) => ({ requirementId: requirement.id, manualOrder: index }));
}

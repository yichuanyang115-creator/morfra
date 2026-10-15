import type { Priority, Requirement } from "../types/models";

/**
 * 迁移属性（旧硬编码字段等价物）在 attributeValues 里的 key。集中管理，
 * 避免各组件里散落裸字符串——改名时只改这一处。
 */
export const FIELD_KEYS = {
  priority: "priority",
  assignee: "assignee",
  source: "source",
  deadline: "deadline",
  progress: "progress",
  releaseMethod: "release_method",
  releaseDate: "release_date",
  result: "result",
} as const;

export type MigratedFieldKey = (typeof FIELD_KEYS)[keyof typeof FIELD_KEYS];

export type ResultValue = "completed" | "abandoned" | null;

export function priorityOf(r: Requirement): Priority {
  const v = r.attributeValues[FIELD_KEYS.priority];
  return v === "P0" || v === "P1" || v === "P2" ? v : "P2";
}

export function assigneeOf(r: Requirement): string {
  const v = r.attributeValues[FIELD_KEYS.assignee];
  return typeof v === "string" ? v : "";
}

export function sourceOf(r: Requirement): string {
  const v = r.attributeValues[FIELD_KEYS.source];
  return typeof v === "string" ? v : "";
}

export function deadlineOf(r: Requirement): string {
  const v = r.attributeValues[FIELD_KEYS.deadline];
  return typeof v === "string" ? v : "";
}

export function progressOf(r: Requirement): number | null {
  const v = r.attributeValues[FIELD_KEYS.progress];
  return typeof v === "number" ? v : null;
}

export function releaseMethodOf(r: Requirement): string {
  const v = r.attributeValues[FIELD_KEYS.releaseMethod];
  return typeof v === "string" ? v : "";
}

export function releaseDateOf(r: Requirement): string {
  const v = r.attributeValues[FIELD_KEYS.releaseDate];
  return typeof v === "string" ? v : "";
}

export function resultOf(r: Requirement): ResultValue {
  const v = r.attributeValues[FIELD_KEYS.result];
  return v === "completed" || v === "abandoned" ? v : null;
}

/** 返回替换单个属性值后的新 attributeValues，不修改原对象。 */
export function withAttributeValue(
  requirement: Requirement,
  key: string,
  value: unknown,
): Record<string, unknown> {
  return { ...requirement.attributeValues, [key]: value };
}

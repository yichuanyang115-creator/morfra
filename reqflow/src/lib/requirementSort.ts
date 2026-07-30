import type { Priority, Requirement } from "../types/models";
import { diffDaysFromToday } from "./dates";
import { lastTransitionTimestamp } from "./requirementMetrics";
import { deadlineOf, priorityOf } from "./requirementFields";

export type SortField = "priority" | "deadline" | "stayDays" | "totalDays" | "createdAt";
export type SortDir = "asc" | "desc";

export const SORT_FIELDS: { key: SortField; label: string }[] = [
  { key: "priority", label: "优先级" },
  { key: "deadline", label: "截止日期" },
  { key: "stayDays", label: "停留天数" },
  { key: "totalDays", label: "总耗时" },
  { key: "createdAt", label: "创建时间" },
];

export interface StageSort {
  mode: "rule" | "manual";
  primary: SortField;
  primaryDir: SortDir;
  secondary: SortField | null;
  secondaryDir: SortDir;
}

/**
 * 默认按创建时间新的在前，跟没有排序功能之前的体感一致（Product-Spec REQ-001 §426）。
 * 用同一个对象引用返回：uiStore.getStageSort 对未配置过的阶段会反复调用这个函数，
 * 若每次都 new 一个对象，Zustand selector 的引用比较会认为状态每次都变了，
 * 触发 React 18+ 的 "Maximum update depth exceeded" 无限渲染循环。
 */
const DEFAULT_STAGE_SORT: StageSort = { mode: "rule", primary: "createdAt", primaryDir: "desc", secondary: null, secondaryDir: "desc" };

export function defaultStageSort(): StageSort {
  return DEFAULT_STAGE_SORT;
}

/** 高亮只代表"用了非默认字段规则"；手动模式（拖拽产生）不算需要提醒的"改过设置"状态。 */
export function isStageSortCustomized(sort: StageSort): boolean {
  return sort.mode === "rule" && (sort.primary !== "createdAt" || sort.primaryDir !== "desc" || !!sort.secondary);
}

const PRIORITY_RANK: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 };

function sortFieldValue(requirement: Requirement, field: SortField): number | string {
  switch (field) {
    case "priority":
      return PRIORITY_RANK[priorityOf(requirement)];
    case "deadline":
      return deadlineOf(requirement) || "9999-99-99";
    case "stayDays": {
      const d = diffDaysFromToday(lastTransitionTimestamp(requirement));
      return d ?? -1;
    }
    case "totalDays": {
      const d = diffDaysFromToday(requirement.createdAt);
      return d ?? -1;
    }
    case "createdAt":
      return requirement.createdAt || "";
  }
}

function compareByField(a: Requirement, b: Requirement, field: SortField, dir: SortDir): number {
  const va = sortFieldValue(a, field);
  const vb = sortFieldValue(b, field);
  const result = va < vb ? -1 : va > vb ? 1 : 0;
  return dir === "desc" ? -result : result;
}

function sortByRule(requirements: Requirement[], sort: StageSort): Requirement[] {
  return requirements.slice().sort((a, b) => {
    const primary = compareByField(a, b, sort.primary, sort.primaryDir);
    if (primary !== 0 || !sort.secondary) return primary;
    return compareByField(a, b, sort.secondary, sort.secondaryDir);
  });
}

/** 手动模式：按 manualOrder 升序排列（越小越靠前），缺失时兜底为 0（Product-Spec 无强制要求，沿用原型体感）。 */
function sortByManualOrder(requirements: Requirement[]): Requirement[] {
  return requirements.slice().sort((a, b) => (a.manualOrder ?? 0) - (b.manualOrder ?? 0));
}

export function sortRequirementsForStage(requirements: Requirement[], sort: StageSort): Requirement[] {
  return sort.mode === "manual" ? sortByManualOrder(requirements) : sortByRule(requirements, sort);
}

/**
 * 拖拽调顺序后重新计算目标阶段全部需求的 manualOrder（0..n-1，按拖拽后的新顺序赋值）。
 * 返回需要落盘更新的 { requirementId, manualOrder } 列表。
 */
export function reorderManualOrder(
  orderedRequirements: Requirement[],
): { requirementId: string; manualOrder: number }[] {
  return orderedRequirements.map((r, idx) => ({ requirementId: r.id, manualOrder: idx }));
}

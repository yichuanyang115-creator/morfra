import type { Requirement } from "../types/models";
import { diffDaysBetween, diffDaysFromToday } from "./dates";

/** 进入当前阶段的时间点：最后一次流转记录的时间，从未流转过则用创建时间（Product-Spec §6.3）。 */
export function lastTransitionTimestamp(requirement: Requirement): string {
  const last = requirement.transitions[requirement.transitions.length - 1];
  return last ? last.timestamp : requirement.createdAt;
}

/** 停留天数：进入当前阶段到今天的自然天数。归档区域不使用此字段（改显示归档时间）。 */
export function stayDays(requirement: Requirement): number | null {
  return diffDaysFromToday(lastTransitionTimestamp(requirement));
}

/** 总耗时：创建到今天的自然天数；归档后冻结为创建到归档时间点的天数（Product-Spec §6.3）。 */
export function totalDays(requirement: Requirement): number | null {
  if (requirement.stage === "archive") {
    return diffDaysBetween(requirement.createdAt, lastTransitionTimestamp(requirement));
  }
  return diffDaysFromToday(requirement.createdAt);
}

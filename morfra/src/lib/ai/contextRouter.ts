import type { AIConversationMode, AIContextRef } from "../../types/ai";

export type AIContextRoute =
  | { type: "none"; reason: "general-question" }
  | { type: "fullTable"; reason: "table-analysis" | "table-signal" }
  | { type: "selectedRecords"; recordIds: string[]; reason: "explicit-selection" }
  | { type: "clarification"; reason: "ambiguous-question" };

export interface ContextRouteInput {
  mode: AIConversationMode;
  message: string;
  selectionReferenced?: boolean;
  selectedRecordIds?: readonly string[];
}

const TABLE_SIGNALS = [
  "表",
  "记录",
  "字段",
  "数据",
  "总数",
  "数量",
  "平均",
  "求和",
  "合计",
  "统计",
  "分组",
  "筛选",
  "排序",
  "空值",
  "状态",
  "进度",
  "金额",
  "截止",
  "哪些",
  "多少",
  "待处理",
  "进行中",
  "已完成",
  "未完成",
  "任务",
  "事项",
  "需求",
  "项目",
  "列表",
  "最高",
  "最低",
  "有没有",
];

const GENERAL_SIGNALS = ["你好", "谢谢", "笑话", "天气", "解释一下", "什么是", "如何学习"];

function hasSignal(message: string, signals: readonly string[]): boolean {
  return signals.some((signal) => message.includes(signal));
}

export function routeContext(input: ContextRouteInput): AIContextRoute {
  const selectedRecordIds = [...(input.selectedRecordIds ?? [])];
  if (input.selectionReferenced) {
    if (selectedRecordIds.length === 0) return { type: "clarification", reason: "ambiguous-question" };
    return { type: "selectedRecords", recordIds: selectedRecordIds, reason: "explicit-selection" };
  }
  if (input.mode === "table-analysis") return { type: "fullTable", reason: "table-analysis" };
  const tableSignal = hasSignal(input.message, TABLE_SIGNALS);
  const generalSignal = hasSignal(input.message, GENERAL_SIGNALS);
  if (tableSignal && !generalSignal) return { type: "fullTable", reason: "table-signal" };
  if (generalSignal && !tableSignal) return { type: "none", reason: "general-question" };
  return { type: "clarification", reason: "ambiguous-question" };
}

export function contextRefForRoute(route: AIContextRoute): AIContextRef | null {
  if (route.type === "none") return { type: "none" };
  if (route.type === "fullTable") return { type: "fullTable" };
  if (route.type === "selectedRecords") return { type: "selectedRecords", recordIds: route.recordIds };
  return null;
}

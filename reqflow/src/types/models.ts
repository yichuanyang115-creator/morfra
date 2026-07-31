export interface Project {
  id: string;
  name: string;
  sources: string[];
}

/**
 * Phase 16 起阶段由 Schema 动态定义（schemaStore.schema.stageOptions），不再是编译期
 * 已知的有限集合，故放宽为 string。`STAGES` 常量下方仍保留作为 reqflow 内置模板阶段的
 * id/label 快照（供 legacyEquivalentSchema 迁移旧项目使用），业务逻辑判断终态与否要查
 * StageOption.isTerminal，不能再靠字符串比较猜测阶段语义（除了 "archive" 作为内置模板
 * 归档阶段的字面量 id，在 createRequirement/transitionRequirement 里仍被引用，见相关注释）。
 */
export type Stage = string;

export type Priority = "P0" | "P1" | "P2";

export interface DeliverableAttach {
  type: "file" | "link";
  url: string;
  label: string;
}

export interface Deliverable {
  id: string;
  name: string;
  checked: boolean;
  attach: DeliverableAttach | null;
  createdAt: string;
}

export type TaskStatus = "todo" | "progress" | "done";

export interface Task {
  id: string;
  name: string;
  assignee: string;
  deadline: string;
  progress: number | null;
  status: TaskStatus;
  blocked: boolean;
  blockNote: string;
  createdAt: string;
}

export interface TransitionRecord {
  id: string;
  from: Stage;
  to: Stage;
  timestamp: string;
  by: string;
  note: string;
}

export interface Comment {
  id: string;
  transitionId: string;
  content: string;
  timestamp: string;
}

export interface Requirement {
  id: string;
  name: string;
  stage: Stage;
  createdAt: string;
  manualOrder: number;
  body: string;
  /** Schema 驱动的属性值，key 是属性 id（见 lib/requirementFields.ts 的迁移属性 key 常量）。 */
  attributeValues: Record<string, unknown>;
  deliverables: Deliverable[];
  tasks: Task[];
  acceptance: AcceptanceCriterion[];
  transitions: TransitionRecord[];
  comments: Comment[];
}

export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "待开始" },
  { key: "progress", label: "进行中" },
  { key: "done", label: "完成" },
];

export type AcceptanceResult = "pass" | "fail" | "unverified";

export interface AcceptanceCriterion {
  id: string;
  desc: string;
  result: AcceptanceResult;
  failNote: string;
  createdAt: string;
}

export const ACCEPTANCE_RESULTS: { key: AcceptanceResult; label: string }[] = [
  { key: "pass", label: "通过" },
  { key: "fail", label: "不通过" },
  { key: "unverified", label: "未验证" },
];

export const STAGES: { key: Stage; label: string }[] = [
  { key: "collect", label: "收集" },
  { key: "need", label: "需求" },
  { key: "design", label: "设计" },
  { key: "dev", label: "开发" },
  { key: "verify", label: "验证" },
  { key: "release", label: "发布" },
  { key: "archive", label: "归档" },
];

export const DEFAULT_SOURCES = ["用户反馈", "竞品分析", "内部想法", "数据分析", "客户定制"];

export const RELEASE_METHODS = ["全量", "灰度", "分批"];

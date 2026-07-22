export interface Project {
  id: string;
  name: string;
  sources: string[];
}

export type Stage = "collect" | "need" | "design" | "dev" | "verify" | "release" | "archive";

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

export interface Requirement {
  id: string;
  name: string;
  stage: Stage;
  priority: Priority;
  source: string;
  assignee: string;
  deadline: string;
  progress: number | null;
  closureType: "completed" | "abandoned" | null;
  createdAt: string;
  body: string;
  deliverables: Deliverable[];
  tasks: Task[];
}

export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "待开始" },
  { key: "progress", label: "进行中" },
  { key: "done", label: "完成" },
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

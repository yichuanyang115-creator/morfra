import type { Task, TaskStatus } from "../../../types/models";
import { TASK_STATUSES } from "../../../types/models";

export type NewTaskInput = { name: string; assignee: string; deadline: string; progress: number | null };
export type TaskPatch = Partial<
  Pick<Task, "name" | "assignee" | "deadline" | "progress" | "status" | "blocked" | "blockNote">
>;

export const TASK_STATUS_ORDER: TaskStatus[] = ["todo", "progress", "done"];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.key, s.label]),
) as Record<TaskStatus, string>;

export const STATUS_PILL_STYLE: Record<TaskStatus, string> = {
  todo: "text-(--module-scope-context-strong) ring-1 ring-inset ring-current",
  progress: "text-(--module-scope-action-base) ring-1 ring-inset ring-current",
  done: "text-(--module-scope-feedback-success) ring-1 ring-inset ring-current",
};

export const STATUS_DOT_STYLE: Record<TaskStatus, string> = {
  todo: "bg-(--module-scope-context-strong)",
  progress: "bg-(--module-scope-action-base)",
  done: "bg-(--module-scope-feedback-success)",
};

export function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

export function clampProgress(value: string): number | null {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

export const metaInputClass =
  "w-27.5 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-1.5 py-0.75 font-(family-name:--font-mono) text-[11.5px] text-(--module-scope-text-primary) outline-none focus:border-(--module-scope-action-base)";

export const metaBtnClass =
  "max-w-30 truncate rounded-(--r-sm) border border-transparent bg-transparent px-1.5 py-0.75 font-(family-name:--font-mono) text-[11.5px] text-(--module-scope-text-tertiary) hover:border-(--module-scope-border-subtle) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)";

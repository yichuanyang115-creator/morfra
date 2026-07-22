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
  todo: "bg-(--st-todo-soft) text-(--muted)",
  progress: "bg-(--st-progress-soft) text-(--st-progress)",
  done: "bg-(--st-done-soft) text-(--st-done)",
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
  "w-27.5 rounded-(--r-sm) border border-(--border) bg-(--surface) px-1.5 py-0.75 font-(family-name:--font-mono) text-[11.5px] text-(--fg) outline-none focus:border-(--accent)";

export const metaBtnClass =
  "max-w-30 truncate rounded-(--r-sm) border border-transparent bg-transparent px-1.5 py-0.75 font-(family-name:--font-mono) text-[11.5px] text-(--muted-2) hover:border-(--border) hover:bg-(--surface-2) hover:text-(--fg)";

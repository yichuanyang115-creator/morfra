import { useState } from "react";
import type { Task } from "../../../types/models";
import {
  clampProgress,
  fmtDate,
  metaBtnClass,
  metaInputClass,
  STATUS_PILL_STYLE,
  STATUS_DOT_STYLE,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  type TaskPatch,
} from "./taskShared";

function BlockIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M10 6.5v4M10 13.2h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TaskCard({
  task,
  onUpdate,
  onRemove,
}: {
  task: Task;
  onUpdate: (patch: TaskPatch) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(task.name);
  const [editingField, setEditingField] = useState<"assignee" | "deadline" | null>(null);
  const [assigneeValue, setAssigneeValue] = useState(task.assignee);
  const [deadlineValue, setDeadlineValue] = useState(task.deadline);
  const [progressInput, setProgressInput] = useState(task.progress == null ? "" : String(task.progress));
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteValue, setNoteValue] = useState(task.blockNote);

  function cycleStatus() {
    const next = TASK_STATUS_ORDER[(TASK_STATUS_ORDER.indexOf(task.status) + 1) % TASK_STATUS_ORDER.length];
    if (next === "done") {
      onUpdate({ status: next, progress: 100 });
      setProgressInput("100");
    } else {
      onUpdate({ status: next });
    }
  }

  function toggleBlocked() {
    const next = !task.blocked;
    onUpdate({ blocked: next });
    if (!next) setNoteOpen(false);
  }

  return (
    <div
      className={`theme-module-business relative mb-1.5 flex flex-col gap-1.5 rounded-(--r-md) border p-2.25 last:mb-0 ${
        task.blocked ? "border-(--module-scope-feedback-danger)" : "border-(--module-scope-border-subtle)"
      }`}
    >
      {task.blocked && <span className="absolute top-2 bottom-2 left-0 w-0.75 rounded-r-sm bg-(--module-scope-feedback-danger)" />}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          placeholder="任务名称"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (trimmed && trimmed !== task.name) onUpdate({ name: trimmed });
            else if (!trimmed) setName(task.name);
          }}
          className="min-w-0 flex-1 rounded-(--r-sm) border border-transparent bg-transparent px-1.5 py-1 font-(family-name:--font-body) text-[13px] text-(--module-scope-text-primary) outline-none hover:border-(--module-scope-border-subtle) hover:bg-(--module-scope-action-soft) focus:border-(--module-scope-action-base) focus:bg-(--module-scope-action-soft)"
        />
        <button
          type="button"
          onClick={cycleStatus}
          aria-label={`任务状态：${TASK_STATUS_LABEL[task.status]}，点击切换到下一状态`}
          className={`inline-flex flex-none items-center gap-1 rounded-full px-1.5 py-0.5 font-(family-name:--font-mono) text-[10.5px] font-[590] tracking-[0.03em] ${STATUS_PILL_STYLE[task.status]}`}
        >
          <span aria-hidden="true" className={`size-1.5 rounded-full ${STATUS_DOT_STYLE[task.status]}`} />
          {TASK_STATUS_LABEL[task.status]}
        </button>
        <button
          type="button"
          aria-pressed={task.blocked}
          aria-label={task.blocked ? "取消标记阻塞" : "标记阻塞"}
          title="标记阻塞"
          onClick={toggleBlocked}
          className={`grid size-6 flex-none place-items-center rounded-(--r-sm) ${
            task.blocked
              ? "text-(--module-scope-feedback-danger) ring-1 ring-inset ring-(--module-scope-feedback-danger)"
              : "text-(--module-scope-text-tertiary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)"
          }`}
        >
          <BlockIcon />
        </button>
        <button
          type="button"
          aria-label="删除任务"
          onClick={onRemove}
          className="grid size-6 flex-none place-items-center rounded-(--r-sm) bg-(--module-scope-background-elevated) text-(--module-scope-text-tertiary) hover:bg-(--module-scope-feedback-danger-soft) hover:text-(--module-scope-feedback-danger)"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-[11.5px] text-(--module-scope-text-tertiary)">
        {editingField === "assignee" ? (
          <input
            type="text"
            autoFocus
            placeholder="负责人"
            value={assigneeValue}
            onChange={(e) => setAssigneeValue(e.target.value)}
            onBlur={() => {
              onUpdate({ assignee: assigneeValue.trim() });
              setEditingField(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              else if (e.key === "Escape") {
                setAssigneeValue(task.assignee);
                setEditingField(null);
              }
            }}
            className={metaInputClass}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setAssigneeValue(task.assignee);
              setEditingField("assignee");
            }}
            className={metaBtnClass}
          >
            {task.assignee || "未指定负责人"}
          </button>
        )}
        {editingField === "deadline" ? (
          <input
            type="date"
            autoFocus
            value={deadlineValue}
            onChange={(e) => setDeadlineValue(e.target.value)}
            onBlur={() => {
              onUpdate({ deadline: deadlineValue });
              setEditingField(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              else if (e.key === "Escape") {
                setDeadlineValue(task.deadline);
                setEditingField(null);
              }
            }}
            className={metaInputClass}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDeadlineValue(task.deadline);
              setEditingField("deadline");
            }}
            className={metaBtnClass}
          >
            {task.deadline ? fmtDate(task.deadline) : "未设置截止日期"}
          </button>
        )}
        <input
          type="number"
          min={0}
          max={100}
          placeholder="—"
          value={progressInput}
          onChange={(e) => setProgressInput(e.target.value)}
          onBlur={() => {
            const clamped = clampProgress(progressInput);
            setProgressInput(clamped == null ? "" : String(clamped));
            if (clamped !== task.progress) onUpdate({ progress: clamped });
          }}
          className="ml-auto w-8 flex-none rounded-(--r-sm) border border-transparent bg-transparent px-0.5 py-0.75 font-(family-name:--font-mono) text-[11.5px] text-(--module-scope-text-secondary) outline-none [appearance:textfield] hover:border-(--module-scope-border-subtle) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong) focus:border-(--module-scope-action-base) focus:bg-(--module-scope-action-soft) focus:text-(--module-scope-text-primary) [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span>%</span>
      </div>
      {task.blocked &&
        (noteOpen ? (
          <textarea
            autoFocus
            placeholder="为什么阻塞？"
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            onBlur={() => {
              onUpdate({ blockNote: noteValue.trim() });
              setNoteOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setNoteValue(task.blockNote);
                setNoteOpen(false);
              }
            }}
            className="min-h-11 w-full resize-y rounded-(--r-sm) border border-(--module-scope-feedback-danger) bg-(--module-scope-background-surface) px-2 py-1.5 font-(family-name:--font-body) text-[12px] text-(--module-scope-text-primary) outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNoteValue(task.blockNote);
              setNoteOpen(true);
            }}
            className="block max-w-full truncate rounded-(--r-sm) px-1 py-0.5 text-left font-(family-name:--font-body) text-[11.5px] text-(--module-scope-feedback-danger) hover:bg-(--module-scope-feedback-danger-soft)"
          >
            {task.blockNote || "点击说明阻塞原因…"}
          </button>
        ))}
    </div>
  );
}

import { useState } from "react";
import { clampProgress, metaInputClass, type NewTaskInput } from "./taskShared";

export function TaskDraftRow({ onCreate, onCancel }: { onCreate: (task: NewTaskInput) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [assignee, setAssignee] = useState("");
  const [deadline, setDeadline] = useState("");
  const [progress, setProgress] = useState("");

  function resolve() {
    const trimmed = name.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    onCreate({ name: trimmed, assignee: assignee.trim(), deadline, progress: clampProgress(progress) });
  }

  return (
    <div
      className="mb-1.5 flex flex-col gap-1.5 rounded-(--r-md) border border-(--accent) bg-(--accent-soft) p-2.25"
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        resolve();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onCancel();
        } else if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          autoFocus
          placeholder="任务名称（必填），填完点其他地方或回车即创建"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-(--r-sm) border border-transparent bg-transparent px-1.5 py-1 font-(family-name:--font-body) text-[13px] text-(--fg) outline-none placeholder:text-(--muted-2) focus:border-(--border) focus:bg-(--surface)"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          placeholder="负责人"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className={metaInputClass}
        />
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={metaInputClass} />
        <input
          type="number"
          min={0}
          max={100}
          placeholder="—"
          value={progress}
          onChange={(e) => setProgress(e.target.value)}
          className="w-8 rounded-(--r-sm) border border-(--border) bg-(--surface) px-0.5 py-0.75 font-(family-name:--font-mono) text-[11.5px] text-(--fg) outline-none [appearance:textfield] focus:border-(--accent) [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="font-(family-name:--font-mono) text-[11.5px] text-(--muted-2)">%</span>
      </div>
    </div>
  );
}

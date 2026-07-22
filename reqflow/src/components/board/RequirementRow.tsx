import { useState } from "react";
import type { Priority, Requirement } from "../../types/models";

const PRIORITY_STYLE: Record<Priority, string> = {
  P0: "bg-(--sev-p0-soft) text-(--sev-p0)",
  P1: "bg-(--sev-p1-soft) text-(--sev-p1)",
  P2: "bg-(--sev-p2-soft) text-(--muted)",
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

function diffDaysFromToday(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((startOfDay(today) - startOfDay(d)) / 86_400_000);
}

function clampProgress(value: string): number | null {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

interface RequirementRowProps {
  requirement: Requirement;
  onProgressChange: (progress: number | null) => void;
}

export function RequirementRow({ requirement, onProgressChange }: RequirementRowProps) {
  const [progressInput, setProgressInput] = useState(requirement.progress == null ? "" : String(requirement.progress));
  // 停留天数口径是"进入当前阶段的时间到今天"（Product-Spec §6.3），Phase 3 还没有流转记录
  // （TransitionRecord 是 Phase 9 范围），暂用 createdAt 代替——新建需求从未流转，两者数值相等。
  // Phase 9 接入流转后要改成"最后一次流转记录的时间，无流转记录则用 createdAt"。
  const stayDays = diffDaysFromToday(requirement.createdAt);
  const totalDays = diffDaysFromToday(requirement.createdAt);

  return (
    <div
      className="grid max-w-(--board-row-max-w) items-center gap-3 border-b border-(--border) px-2 py-2 hover:bg-(--surface)"
      style={{ gridTemplateColumns: "minmax(140px, 320px) 40px 56px 56px 52px 56px 56px 40px" }}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-(--fg)">
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{requirement.name}</span>
      </div>
      <div className="flex justify-center">
        <span
          className={`inline-flex h-5 w-fit items-center justify-center rounded-(--r-sm) px-1.75 font-(family-name:--font-mono) text-[10.5px] font-[590] tracking-[0.05em] ${PRIORITY_STYLE[requirement.priority]}`}
        >
          {requirement.priority}
        </span>
      </div>
      <div className="overflow-hidden text-ellipsis text-center font-(family-name:--font-mono) text-[12px] whitespace-nowrap text-(--muted)">
        {requirement.assignee || "—"}
      </div>
      <div className="overflow-hidden text-ellipsis text-center font-(family-name:--font-mono) text-[12px] whitespace-nowrap text-(--muted)">
        {fmtDate(requirement.createdAt)}
      </div>
      <div className="overflow-hidden text-ellipsis text-center font-(family-name:--font-mono) text-[12px] whitespace-nowrap text-(--muted)">
        {fmtDate(requirement.deadline)}
      </div>
      <div className="overflow-hidden text-ellipsis text-center font-(family-name:--font-mono) text-[12px] whitespace-nowrap text-(--muted)">
        {stayDays != null ? `${stayDays}d` : "—"}
      </div>
      <div className="overflow-hidden text-ellipsis text-center font-(family-name:--font-mono) text-[12px] whitespace-nowrap text-(--muted)">
        {totalDays != null ? `${totalDays}d` : "—"}
      </div>
      <div className="flex items-center justify-center font-(family-name:--font-mono) text-[12px] text-(--muted)">
        <input
          type="number"
          min={0}
          max={100}
          placeholder="—"
          value={progressInput}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setProgressInput(e.target.value)}
          onBlur={() => {
            const clamped = clampProgress(progressInput);
            setProgressInput(clamped == null ? "" : String(clamped));
            if (clamped !== requirement.progress) onProgressChange(clamped);
          }}
          className="w-7 rounded border border-transparent bg-transparent px-0.5 py-px text-right font-(family-name:--font-mono) text-[12px] text-(--muted) outline-none [appearance:textfield] hover:border-(--border) hover:bg-(--surface-2) hover:text-(--fg) focus:border-(--border) focus:bg-(--surface-2) focus:text-(--fg) [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        %
      </div>
    </div>
  );
}

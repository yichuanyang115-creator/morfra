import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Priority, Requirement } from "../../types/models";
import { RELEASE_METHODS } from "../../types/models";
import { fmtDate } from "../../lib/dates";
import { lastTransitionTimestamp, stayDays as computeStayDays, totalDays as computeTotalDays } from "../../lib/requirementMetrics";

const PRIORITY_STYLE: Record<Priority, string> = {
  P0: "bg-(--sev-p0-soft) text-(--sev-p0)",
  P1: "bg-(--sev-p1-soft) text-(--sev-p1)",
  P2: "bg-(--sev-p2-soft) text-(--muted)",
};

function clampProgress(value: string): number | null {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

interface RequirementRowProps {
  requirement: Requirement;
  selected: boolean;
  onSelect: () => void;
  onProgressChange: (progress: number | null) => void;
  onReleaseMethodChange: (method: string) => void;
  onReleaseDateChange: (date: string) => void;
}

export function RequirementRow({
  requirement,
  selected,
  onSelect,
  onProgressChange,
  onReleaseMethodChange,
  onReleaseDateChange,
}: RequirementRowProps) {
  const [progressInput, setProgressInput] = useState(requirement.progress == null ? "" : String(requirement.progress));
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: requirement.id });
  const isRelease = requirement.stage === "release";
  const isArchive = requirement.stage === "archive";
  const stayDays = computeStayDays(requirement);
  const totalDays = computeTotalDays(requirement);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={`grid max-w-(--board-row-max-w) cursor-pointer items-center gap-3 border-b border-(--border) px-2 py-2 ${
        isDragging ? "opacity-40" : ""
      } ${
        selected
          ? "border-(--accent-soft-strong) bg-(--accent-soft) shadow-[inset_2px_0_0_0_var(--accent-solid)]"
          : "hover:bg-(--surface)"
      }`}
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
      {isRelease ? (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={requirement.releaseMethod}
            aria-label="发布方式"
            onChange={(e) => onReleaseMethodChange(e.target.value)}
            className="w-full cursor-pointer rounded border border-transparent bg-transparent px-0.5 text-center font-(family-name:--font-mono) text-[12px] text-(--muted) outline-none hover:border-(--border) hover:bg-(--surface-2) hover:text-(--fg) focus:border-(--border) focus:bg-(--surface-2) focus:text-(--fg)"
          >
            <option value="">未设置</option>
            {RELEASE_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="overflow-hidden text-ellipsis text-center font-(family-name:--font-mono) text-[12px] whitespace-nowrap text-(--muted)">
          {isArchive ? fmtDate(lastTransitionTimestamp(requirement)) : stayDays != null ? `${stayDays}d` : "—"}
        </div>
      )}
      {isRelease ? (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <span className="pointer-events-none block overflow-hidden text-ellipsis text-center font-(family-name:--font-mono) text-[12px] whitespace-nowrap text-(--muted)">
            {fmtDate(requirement.releaseDate)}
          </span>
          <input
            type="date"
            aria-label="发布时间"
            value={requirement.releaseDate}
            onChange={(e) => onReleaseDateChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
      ) : (
        <div className="overflow-hidden text-ellipsis text-center font-(family-name:--font-mono) text-[12px] whitespace-nowrap text-(--muted)">
          {totalDays != null ? `${totalDays}d` : "—"}
        </div>
      )}
      <div className="flex items-center justify-center font-(family-name:--font-mono) text-[12px] text-(--muted)">
        {isArchive ? (
          <span>{requirement.closureType === "abandoned" ? "废弃" : "完成"}</span>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

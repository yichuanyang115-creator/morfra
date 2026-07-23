import { useState } from "react";
import type { Priority, Requirement } from "../../types/models";
import { STAGES } from "../../types/models";

interface AttributeGridProps {
  requirement: Requirement;
  sources: string[];
  onFieldChange: <K extends "priority" | "assignee" | "source" | "deadline">(
    field: K,
    value: Requirement[K],
  ) => void;
  onProgressChange: (progress: number | null) => void;
  onAddSource: (source: string) => void;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

function clampProgress(value: string): number | null {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

const inputClass =
  "block h-7 w-full rounded-(--r-sm) border border-transparent bg-transparent px-1.5 font-(family-name:--font-body) text-[12.5px] leading-6.5 text-(--fg) outline-none hover:border-(--border) hover:bg-(--surface) focus:border-(--border) focus:bg-(--surface)";

const SELECT_ARROW_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%2368748a' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

const selectClass = `${inputClass} cursor-pointer appearance-none bg-no-repeat pr-5`;
const selectStyle: React.CSSProperties = {
  backgroundImage: SELECT_ARROW_URL,
  backgroundPosition: "right 2px center",
  backgroundSize: "16px",
};

const readonlyClass = "block h-7 w-full rounded-(--r-sm) border border-transparent px-1.5 font-(family-name:--font-body) text-[12.5px] leading-6.5 text-(--muted)";

function AttrRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="text-[12px] whitespace-nowrap text-(--muted-2)">{label}</div>
      <div className="min-w-0">{children}</div>
    </>
  );
}

function stageSlot(requirement: Requirement): { label: string; value: string } {
  switch (requirement.stage) {
    case "design": {
      const done = requirement.deliverables.filter((d) => d.checked).length;
      return { label: "产出", value: `${done}/${requirement.deliverables.length}` };
    }
    case "dev": {
      const done = requirement.tasks.filter((t) => t.status === "done").length;
      return { label: "任务", value: `${done}/${requirement.tasks.length}` };
    }
    case "verify": {
      const passed = requirement.acceptance.filter((a) => a.result === "pass").length;
      return { label: "验收", value: `${passed}/${requirement.acceptance.length}` };
    }
    case "release":
      return { label: "方式", value: "未设置" };
    case "archive":
      return { label: "结果", value: requirement.closureType === "abandoned" ? "废弃" : "完成" };
    default:
      return { label: "—", value: "—" };
  }
}

export function AttributeGrid({ requirement, sources, onFieldChange, onProgressChange, onAddSource }: AttributeGridProps) {
  const [progressInput, setProgressInput] = useState(requirement.progress == null ? "" : String(requirement.progress));
  const [customizingSource, setCustomizingSource] = useState(false);
  const [customSourceValue, setCustomSourceValue] = useState("");
  const slot = stageSlot(requirement);
  const stageLabel = STAGES.find((s) => s.key === requirement.stage)?.label ?? requirement.stage;

  function commitCustomSource() {
    const trimmed = customSourceValue.trim();
    if (trimmed) {
      onAddSource(trimmed);
      onFieldChange("source", trimmed);
    }
    setCustomizingSource(false);
    setCustomSourceValue("");
  }

  return (
    <div
      className="mx-4 my-3 grid items-center gap-y-2 gap-x-2.5 rounded-(--r-lg) bg-(--surface-2) p-3"
      style={{ gridTemplateColumns: "58px minmax(0, 1fr) 58px minmax(0, 1fr)" }}
    >
      <AttrRow label="优先级">
        <select
          value={requirement.priority}
          onChange={(e) => onFieldChange("priority", e.target.value as Priority)}
          className={selectClass}
          style={selectStyle}
        >
          {(["P0", "P1", "P2"] as const).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </AttrRow>

      <AttrRow label="负责人">
        <input
          type="text"
          defaultValue={requirement.assignee}
          placeholder="未指定"
          onBlur={(e) => onFieldChange("assignee", e.target.value)}
          className={inputClass}
        />
      </AttrRow>

      <AttrRow label="来源">
        {customizingSource ? (
          <input
            type="text"
            autoFocus
            placeholder="输入新来源名称"
            value={customSourceValue}
            onChange={(e) => setCustomSourceValue(e.target.value)}
            onBlur={commitCustomSource}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitCustomSource();
              } else if (e.key === "Escape") {
                setCustomizingSource(false);
                setCustomSourceValue("");
              }
            }}
            className={inputClass}
          />
        ) : (
          <select
            value={requirement.source}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setCustomizingSource(true);
              } else {
                onFieldChange("source", e.target.value);
              }
            }}
            className={selectClass}
            style={selectStyle}
          >
            {!sources.includes(requirement.source) && requirement.source && (
              <option value={requirement.source}>{requirement.source}</option>
            )}
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="__custom__">自定义…</option>
          </select>
        )}
      </AttrRow>

      <AttrRow label="进度">
        {requirement.stage === "archive" ? (
          <span className={readonlyClass}>{requirement.closureType === "abandoned" ? "废弃" : "完成"}</span>
        ) : (
          <input
            type="number"
            min={0}
            max={100}
            placeholder="未填写"
            value={progressInput}
            onChange={(e) => setProgressInput(e.target.value)}
            onBlur={() => {
              const clamped = clampProgress(progressInput);
              setProgressInput(clamped == null ? "" : String(clamped));
              if (clamped !== requirement.progress) onProgressChange(clamped);
            }}
            className={`${inputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
          />
        )}
      </AttrRow>

      <AttrRow label="阶段">
        <span className={readonlyClass}>{stageLabel}</span>
      </AttrRow>

      <AttrRow label={slot.label}>
        <span className={readonlyClass}>{slot.value}</span>
      </AttrRow>

      <AttrRow label="截止日期">
        <input
          type="date"
          defaultValue={requirement.deadline}
          onBlur={(e) => onFieldChange("deadline", e.target.value)}
          className={inputClass}
        />
      </AttrRow>

      <AttrRow label="创建时间">
        <span className={readonlyClass}>{fmtDate(requirement.createdAt)}</span>
      </AttrRow>
    </div>
  );
}

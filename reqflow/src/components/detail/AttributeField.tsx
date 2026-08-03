import { useState } from "react";
import type { Requirement } from "../../types/models";
import type { Attribute } from "../../types/schema";
import { fmtDate } from "../../lib/dates";
import { lastTransitionTimestamp, stayDays as computeStayDays, totalDays as computeTotalDays } from "../../lib/requirementMetrics";
import { paletteColorAt } from "../../lib/stagePalette";

export const inputClass =
  "block h-7 w-full rounded-(--r-sm) border border-transparent bg-transparent px-1.5 font-(family-name:--font-body) text-[12.5px] leading-6.5 text-(--fg) outline-none hover:border-(--border) hover:bg-(--surface) focus:border-(--border) focus:bg-(--surface)";

const SELECT_ARROW_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%2368748a' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export const selectClass = `${inputClass} cursor-pointer appearance-none bg-no-repeat pr-5`;
export const selectStyle: React.CSSProperties = {
  backgroundImage: SELECT_ARROW_URL,
  backgroundPosition: "right 2px center",
  backgroundSize: "16px",
};

const readonlyClass = "block h-7 w-full rounded-(--r-sm) border border-transparent px-1.5 font-(family-name:--font-body) text-[12.5px] leading-6.5 text-(--muted)";

const PRIORITY_BADGE_STYLE: Record<string, string> = {
  P0: "bg-(--sev-p0-soft) text-(--sev-p0)",
  P1: "bg-(--sev-p1-soft) text-(--sev-p1)",
  P2: "bg-(--sev-p2-soft) text-(--muted)",
};

function clampPercent(value: string): number | null {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function SingleSelectField({
  attribute,
  value,
  onChange,
}: {
  attribute: Attribute;
  value: string;
  onChange: (value: unknown) => void;
}) {
  const options = attribute.options ?? [];

  return (
    <select
      value={value}
      aria-label={attribute.name}
      onChange={(e) => onChange(e.target.value || null)}
      className={selectClass}
      style={selectStyle}
    >
      <option value="">未设置</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SingleSelectReadonly({ attribute, value }: { attribute: Attribute; value: string }) {
  const options = attribute.options ?? [];
  const selected = options.find((o) => o.id === value);
  const isPriority = attribute.id === "priority";
  const badgeClass = isPriority && value ? PRIORITY_BADGE_STYLE[value] : undefined;
  const badgeColor = !isPriority && value ? selected?.color ?? paletteColorAt(options.findIndex((o) => o.id === value)) : undefined;

  if (!selected) return <span className={readonlyClass}>—</span>;

  return (
    <span
      className={`inline-flex h-6.5 w-fit items-center rounded-(--r-sm) px-1.75 font-(family-name:--font-body) text-[12.5px] ${badgeClass ?? ""}`}
      style={badgeColor ? { backgroundColor: badgeColor } : undefined}
    >
      {selected.label}
    </span>
  );
}

function MultiSelectField({
  attribute,
  value,
  onChange,
}: {
  attribute: Attribute;
  value: string[];
  onChange: (value: unknown) => void;
}) {
  const options = attribute.options ?? [];
  const selectedOptions = options.filter((o) => value.includes(o.id));

  function toggle(optionId: string) {
    const next = value.includes(optionId) ? value.filter((id) => id !== optionId) : [...value, optionId];
    onChange(next);
  }

  return (
    <div className="flex min-h-7 flex-wrap items-center gap-1 px-1.5 py-1">
      {options.length === 0 && selectedOptions.length === 0 ? (
        <span className="text-[12.5px] text-(--muted-2)">未设置</span>
      ) : (
        options.map((o) => {
          const active = value.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              style={active ? { backgroundColor: o.color ?? paletteColorAt(options.findIndex((opt) => opt.id === o.id)) } : undefined}
              className={`inline-flex h-6 w-fit items-center rounded-(--r-sm) px-1.75 font-(family-name:--font-body) text-[12px] ${
                active ? "text-(--fg)" : "border border-(--border) text-(--muted-2)"
              }`}
            >
              {o.label}
            </button>
          );
        })
      )}
    </div>
  );
}

function NumberField({ value, onChange }: { value: number | null; onChange: (value: unknown) => void }) {
  return (
    <input
      type="number"
      placeholder="未填写"
      defaultValue={value ?? ""}
      onBlur={(e) => {
        const trimmed = e.target.value.trim();
        const n = trimmed === "" ? null : Number.parseFloat(trimmed);
        onChange(n === null || Number.isNaN(n) ? null : n);
      }}
      className={`${inputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
    />
  );
}

function PercentField({ value, onChange }: { value: number | null; onChange: (value: unknown) => void }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  return (
    <input
      type="number"
      min={0}
      max={100}
      placeholder="未填写"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const clamped = clampPercent(draft);
        setDraft(clamped == null ? "" : String(clamped));
        if (clamped !== value) onChange(clamped);
      }}
      className={`${inputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
    />
  );
}

function DateField({ value, onChange }: { value: string; onChange: (value: unknown) => void }) {
  return (
    <input
      type="date"
      defaultValue={value}
      onBlur={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  );
}

function TextField({ value, onChange }: { value: string; onChange: (value: unknown) => void }) {
  return (
    <input
      type="text"
      defaultValue={value}
      placeholder="未填写"
      onBlur={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  );
}

function CheckboxField({ attribute, value, onChange }: { attribute: Attribute; value: boolean; onChange: (value: unknown) => void }) {
  return (
    <div className="flex h-7 items-center px-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={value}
        aria-label={attribute.name}
        onClick={() => onChange(!value)}
        className={`grid size-4 flex-none place-items-center rounded border-1.5 ${
          value ? "border-(--accent) bg-(--accent) text-white" : "border-(--border-strong) bg-(--surface) text-transparent"
        }`}
      >
        <svg viewBox="0 0 20 20" fill="none" className="size-2.5">
          <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function AttachmentField({ value }: { value: unknown }) {
  const count = Array.isArray(value) ? value.length : 0;
  return <span className={readonlyClass}>{count > 0 ? `${count} 项` : "未附加"}</span>;
}

function ComputedField({ attribute, requirement }: { attribute: Attribute; requirement: Requirement }) {
  const isArchive = requirement.stage === "archive";

  switch (attribute.computedKind) {
    case "createdAt":
      return <span className={readonlyClass}>{fmtDate(requirement.createdAt)}</span>;
    case "stayDays": {
      if (isArchive) return <span className={readonlyClass}>{fmtDate(lastTransitionTimestamp(requirement))}</span>;
      const d = computeStayDays(requirement);
      return <span className={readonlyClass}>{d != null ? `${d}d` : "—"}</span>;
    }
    case "totalDays": {
      const d = computeTotalDays(requirement);
      return <span className={readonlyClass}>{d != null ? `${d}d` : "—"}</span>;
    }
    default:
      return <span className={readonlyClass}>—</span>;
  }
}

interface AttributeFieldProps {
  attribute: Attribute;
  requirement: Requirement;
  /** 由调用方按"是否终态阶段 + 是否 result 属性"算好后传入。 */
  readOnly: boolean;
  onChange: (value: unknown) => void;
}

export function AttributeField({ attribute, requirement, readOnly, onChange }: AttributeFieldProps) {
  if (attribute.type === "computed") {
    return <ComputedField attribute={attribute} requirement={requirement} />;
  }

  const value = requirement.attributeValues[attribute.id];

  if (attribute.type === "singleSelect" && readOnly) {
    return <SingleSelectReadonly attribute={attribute} value={typeof value === "string" ? value : ""} />;
  }

  switch (attribute.type) {
    case "singleSelect":
      return <SingleSelectField attribute={attribute} value={typeof value === "string" ? value : ""} onChange={onChange} />;
    case "multiSelect":
      return <MultiSelectField attribute={attribute} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />;
    case "number":
      return <NumberField value={typeof value === "number" ? value : null} onChange={onChange} />;
    case "percent":
      return <PercentField value={typeof value === "number" ? value : null} onChange={onChange} />;
    case "date":
      return <DateField value={typeof value === "string" ? value : ""} onChange={onChange} />;
    case "text":
      return <TextField value={typeof value === "string" ? value : ""} onChange={onChange} />;
    case "checkbox":
      return <CheckboxField attribute={attribute} value={value === true} onChange={onChange} />;
    case "attachment":
      return <AttachmentField value={value} />;
    default:
      return <span className={readonlyClass}>—</span>;
  }
}

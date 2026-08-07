import type { Attribute } from "../../types/schema";
import type { Requirement } from "../../types/models";
import { fmtDate } from "../../lib/dates";
import { lastTransitionTimestamp, stayDays as computeStayDays, totalDays as computeTotalDays } from "../../lib/requirementMetrics";
import { paletteColorAt } from "../../lib/stagePalette";

const PRIORITY_STYLE: Record<string, string> = {
  P0: "text-(--sev-p0)",
  P1: "text-(--sev-p1)",
  P2: "text-(--sev-p2)",
};

const PRIORITY_DOT_STYLE: Record<string, string> = {
  P0: "bg-(--sev-p0)",
  P1: "bg-(--sev-p1)",
  P2: "bg-(--sev-p2)",
};

const cellTextClass = "overflow-hidden text-ellipsis text-center font-(family-name:--font-mono) text-[12px] whitespace-nowrap text-(--muted)";

function clampPercent(value: string): number | null {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function badgeStyleFor(attribute: Attribute, optionId: string, optionIndex: number): string | undefined {
  if (attribute.id === "priority") return undefined;
  const option = attribute.options?.find((o) => o.id === optionId);
  return option?.color ?? paletteColorAt(optionIndex);
}

function SelectMarker({ label, color }: { label: string; color?: string }) {
  return (
    <span className="inline-flex items-center">
      <span className="mr-1.5 size-1.5 rounded-full" style={color ? { backgroundColor: color } : undefined} aria-hidden="true" />
      {label}
    </span>
  );
}

function PriorityMarker({ value, color }: { value: string; color?: string }) {
  return (
    <span
      className={`mr-1.5 size-1.5 rounded-full ${color ? "" : PRIORITY_DOT_STYLE[value] ?? "bg-(--context-strong)"}`}
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    />
  );
}

interface FieldCellProps {
  attribute: Attribute;
  requirement: Requirement;
  /** 该单元格是否只读展示（如归档态的"结果"属性，值由流转产生，不允许手动改）。 */
  readOnly?: boolean;
  onChange: (value: unknown) => void;
}

export function FieldCell({ attribute, requirement, readOnly, onChange }: FieldCellProps) {
  if (attribute.type === "computed") {
    return <ComputedCell attribute={attribute} requirement={requirement} />;
  }

  const value = requirement.attributeValues[attribute.id];

  switch (attribute.type) {
    case "singleSelect":
      return (
        <SingleSelectCell attribute={attribute} value={typeof value === "string" ? value : ""} readOnly={readOnly} onChange={onChange} />
      );
    case "multiSelect":
      return (
        <MultiSelectCell attribute={attribute} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
      );
    case "number":
      return <NumberCell value={typeof value === "number" ? value : null} onChange={onChange} />;
    case "percent":
      return <PercentCell value={typeof value === "number" ? value : null} onChange={onChange} />;
    case "date":
      return <DateCell value={typeof value === "string" ? value : ""} onChange={onChange} />;
    case "text":
      return <TextCell value={typeof value === "string" ? value : ""} onChange={onChange} />;
    case "checkbox":
      return <CheckboxCell value={value === true} onChange={onChange} />;
    case "attachment":
      return <AttachmentCell value={value} />;
    default:
      return <div className={cellTextClass}>—</div>;
  }
}

function SingleSelectCell({
  attribute,
  value,
  readOnly,
  onChange,
}: {
  attribute: Attribute;
  value: string;
  readOnly?: boolean;
  onChange: (value: unknown) => void;
}) {
  const options = attribute.options ?? [];
  const selected = options.find((o) => o.id === value);

  if (readOnly) {
    return (
      <div className={cellTextClass}>
        {selected ? (
          attribute.id === "priority" ? (
            <span className={`inline-flex items-center ${PRIORITY_STYLE[value] ?? ""}`}>
              <PriorityMarker value={value} color={selected.color} />
              {selected.label}
            </span>
          ) : <SelectMarker label={selected.label} color={selected.color ?? paletteColorAt(options.findIndex((option) => option.id === value))} />
        ) : "—"}
      </div>
    );
  }

  const isPriority = attribute.id === "priority";
  const badgeStyle = value
    ? isPriority
      ? PRIORITY_STYLE[value]
      : undefined
    : undefined;
  const badgeColor = !isPriority && value ? badgeStyleFor(attribute, value, options.findIndex((o) => o.id === value)) : undefined;

  return (
    <div className="relative flex justify-center" onClick={(e) => e.stopPropagation()}>
      {selected && (
        <span className={`pointer-events-none inline-flex h-5 w-fit items-center justify-center font-(family-name:--font-mono) text-[10.5px] font-[590] tracking-[0.05em] ${badgeStyle ?? ""}`}>
          {isPriority ? (
            <PriorityMarker value={value} color={selected.color} />
          ) : (
            <span className="mr-1.5 size-1.5 rounded-full" style={badgeColor ? { backgroundColor: badgeColor } : undefined} aria-hidden="true" />
          )}
          {selected.label}
        </span>
      )}
      <select
        value={value}
        aria-label={attribute.name}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        <option value="">未设置</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MultiSelectCell({
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
    <div className="flex flex-wrap items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
      {selectedOptions.length === 0 ? (
        <span className={cellTextClass}>—</span>
      ) : (
        selectedOptions.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            className="inline-flex h-5 w-fit items-center justify-center rounded-(--r-sm) px-1.75 font-(family-name:--font-mono) text-[10.5px] font-[590] tracking-[0.05em] text-(--fg) hover:bg-(--accent-soft)"
          >
            <span className="mr-1.5 size-1.5 rounded-full" style={{ backgroundColor: o.color ?? paletteColorAt(options.findIndex((opt) => opt.id === o.id)) }} aria-hidden="true" />
            {o.label}
          </button>
        ))
      )}
    </div>
  );
}

function NumberCell({ value, onChange }: { value: number | null; onChange: (value: unknown) => void }) {
  return (
    <input
      type="number"
      placeholder="—"
      defaultValue={value ?? ""}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        const trimmed = e.target.value.trim();
        const n = trimmed === "" ? null : Number.parseFloat(trimmed);
        onChange(n === null || Number.isNaN(n) ? null : n);
      }}
      className="w-full rounded border border-transparent bg-transparent px-0.5 py-px text-center font-(family-name:--font-mono) text-[12px] text-(--muted) outline-none [appearance:textfield] hover:border-(--border) hover:bg-(--accent-soft) hover:text-(--accent-text) focus:border-(--accent) focus:bg-(--accent-soft) focus:text-(--fg) [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

function PercentCell({ value, onChange }: { value: number | null; onChange: (value: unknown) => void }) {
  return (
    <div className="flex items-center justify-center font-(family-name:--font-mono) text-[12px] text-(--muted)">
      <input
        type="number"
        min={0}
        max={100}
        placeholder="—"
        defaultValue={value ?? ""}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => {
          const clamped = clampPercent(e.target.value);
          onChange(clamped);
        }}
        className="w-7 rounded border border-transparent bg-transparent px-0.5 py-px text-right font-(family-name:--font-mono) text-[12px] text-(--muted) outline-none [appearance:textfield] hover:border-(--border) hover:bg-(--accent-soft) hover:text-(--accent-text) focus:border-(--accent) focus:bg-(--accent-soft) focus:text-(--fg) [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      %
    </div>
  );
}

function DateCell({ value, onChange }: { value: string; onChange: (value: unknown) => void }) {
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <span className="pointer-events-none block overflow-hidden text-ellipsis text-center font-(family-name:--font-mono) text-[12px] whitespace-nowrap text-(--muted)">
        {fmtDate(value)}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

function TextCell({ value, onChange }: { value: string; onChange: (value: unknown) => void }) {
  return (
    <input
      type="text"
      defaultValue={value}
      placeholder="—"
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => onChange(e.target.value)}
      className="w-full overflow-hidden rounded border border-transparent bg-transparent px-0.5 text-center font-(family-name:--font-mono) text-[12px] text-(--muted) outline-none hover:border-(--border) hover:bg-(--accent-soft) hover:text-(--accent-text) focus:border-(--accent) focus:bg-(--accent-soft) focus:text-(--fg)"
    />
  );
}

function CheckboxCell({ value, onChange }: { value: boolean; onChange: (value: unknown) => void }) {
  return (
    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        role="checkbox"
        aria-checked={value}
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

function AttachmentCell({ value }: { value: unknown }) {
  const count = Array.isArray(value) ? value.length : 0;
  return <div className={cellTextClass}>{count > 0 ? `${count} 项` : "—"}</div>;
}

function ComputedCell({ attribute, requirement }: { attribute: Attribute; requirement: Requirement }) {
  const isArchive = requirement.stage === "archive";

  switch (attribute.computedKind) {
    case "createdAt":
      return <div className={cellTextClass}>{fmtDate(requirement.createdAt)}</div>;
    case "stayDays": {
      if (isArchive) return <div className={cellTextClass}>{fmtDate(lastTransitionTimestamp(requirement))}</div>;
      const d = computeStayDays(requirement);
      return <div className={cellTextClass}>{d != null ? `${d}d` : "—"}</div>;
    }
    case "totalDays": {
      const d = computeTotalDays(requirement);
      return <div className={cellTextClass}>{d != null ? `${d}d` : "—"}</div>;
    }
    default:
      return <div className={cellTextClass}>—</div>;
  }
}

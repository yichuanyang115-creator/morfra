import { useEffect, useRef, useState } from "react";
import { SORT_FIELDS, isStageSortCustomized, type SortDir, type SortField, type StageSort } from "../../lib/requirementSort";

function SortIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M4 6h12M6 10h8M8.5 14h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevDownIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevUpIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface SortFieldRowProps {
  label: string;
  field: SortField | "";
  dir: SortDir;
  allowNone: boolean;
  onFieldChange: (field: string) => void;
  onToggleDir: () => void;
}

function SortFieldRow({ label, field, dir, allowNone, onFieldChange, onToggleDir }: SortFieldRowProps) {
  const dirDisabled = allowNone && !field;
  return (
    <div className="flex items-center gap-1.5 px-0.5 py-1">
      <span className="w-10.5 flex-none text-[11px] text-(--muted-2)">{label}</span>
      <select
        value={field}
        onChange={(e) => onFieldChange(e.target.value)}
        className="min-w-0 flex-1 rounded border border-(--border) bg-(--surface) px-1.5 py-1 text-[12px] text-(--fg) outline-none"
      >
        {allowNone && <option value="">不设置</option>}
        {SORT_FIELDS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={dirDisabled}
        onClick={onToggleDir}
        title={dir === "desc" ? "降序" : "升序"}
        aria-label={dir === "desc" ? "切换为升序" : "切换为降序"}
        className="grid size-6 flex-none place-items-center rounded border-none bg-transparent text-(--muted) disabled:opacity-40 hover:bg-(--surface-2) hover:text-(--fg)"
      >
        {dir === "desc" ? <ChevDownIcon /> : <ChevUpIcon />}
      </button>
    </div>
  );
}

interface SortControlProps {
  sort: StageSort;
  onSetPrimaryField: (field: SortField) => void;
  onSetSecondaryField: (field: SortField | null) => void;
  onToggleDir: (slot: "primary" | "secondary") => void;
  onRestore: () => void;
}

export function SortControl({ sort, onSetPrimaryField, onSetSecondaryField, onToggleDir, onRestore }: SortControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex-none" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="排序"
        aria-label="排序"
        className={`grid size-6 place-items-center rounded-(--r-sm) border-none bg-transparent ${
          isStageSortCustomized(sort) ? "bg-(--accent-soft) text-(--accent-text)" : "text-(--muted-2) hover:bg-(--surface-2) hover:text-(--fg)"
        }`}
      >
        <SortIcon />
      </button>

      {open && (
        <div className="absolute top-[30px] right-0 z-6 w-60 rounded-(--r-lg) border border-(--border-strong) bg-(--surface) p-2 shadow-[0_12px_32px_-8px_rgba(30,40,70,0.18),0_2px_8px_rgba(30,40,70,0.05)]">
          {sort.mode === "manual" && (
            <div className="mb-2 flex items-center justify-between gap-1.5 rounded-(--r-sm) bg-(--surface-2) px-2 py-1.5 text-[11.5px] text-(--muted)">
              <span>已手动调整顺序</span>
              <button
                type="button"
                onClick={onRestore}
                className="flex-none rounded-(--r-sm) border-none bg-transparent px-1 py-0.5 text-[11.5px] font-[550] text-(--accent-text) hover:bg-(--accent-soft)"
              >
                恢复排序
              </button>
            </div>
          )}
          <SortFieldRow
            label="主排序"
            field={sort.primary}
            dir={sort.primaryDir}
            allowNone={false}
            onFieldChange={(field) => onSetPrimaryField(field as SortField)}
            onToggleDir={() => onToggleDir("primary")}
          />
          <SortFieldRow
            label="次排序"
            field={sort.secondary ?? ""}
            dir={sort.secondaryDir}
            allowNone
            onFieldChange={(field) => onSetSecondaryField(field ? (field as SortField) : null)}
            onToggleDir={() => onToggleDir("secondary")}
          />
        </div>
      )}
    </div>
  );
}

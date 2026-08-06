import { useEffect, useRef, useState } from "react";
import type { Attribute, SortRule } from "../../types/schema";
import { isSortRuleActive, sortableAttributes } from "../../lib/requirementSort";

function SortIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M4 6h12M6 10h8M8.5 14h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevDownIcon() {
  return <svg className="icon-sm" viewBox="0 0 20 20" fill="none"><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChevUpIcon() {
  return <svg className="icon-sm" viewBox="0 0 20 20" fill="none"><path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

interface SortControlProps {
  rule: SortRule | null;
  attributes: Attribute[];
  manual: boolean;
  hasLocalRule: boolean;
  onChange: (rule: SortRule | null) => void;
  onToggleDirection: () => void;
  onRestore: () => void;
}

export function SortControl({ rule, attributes, manual, hasLocalRule, onChange, onToggleDirection, onRestore }: SortControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const options = sortableAttributes(attributes);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex-none" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="排序"
        aria-label="排序"
        className={`grid size-6 place-items-center rounded-(--r-sm) border-none bg-transparent ${
          manual || hasLocalRule ? "bg-(--accent-soft) text-(--accent-text)" : "text-(--muted-2) hover:bg-(--surface-2) hover:text-(--fg)"
        }`}
      >
        <SortIcon />
      </button>
      {open && (
        <div className="absolute top-[30px] right-0 z-6 w-60 rounded-(--r-lg) border border-(--border-strong) bg-(--surface) p-2 shadow-[0_12px_32px_-8px_rgba(30,40,70,0.18),0_2px_8px_rgba(30,40,70,0.05)]">
          {manual && (
            <div className="mb-2 flex items-center justify-between gap-1.5 rounded-(--r-sm) bg-(--surface-2) px-2 py-1.5 text-[11.5px] text-(--muted)">
              <span>已手动调整顺序</span>
              <button type="button" onClick={onRestore} className="flex-none rounded-(--r-sm) border-none bg-transparent px-1 py-0.5 text-[11.5px] font-[550] text-(--accent-text) hover:bg-(--accent-soft)">
                恢复规则
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-0.5 py-1">
            <span className="w-10.5 flex-none text-[11px] text-(--muted-2)">排序字段</span>
            <select
              value={rule?.attrId ?? ""}
              onChange={(event) => onChange(event.target.value ? { attrId: event.target.value, direction: rule?.direction ?? "asc" } : null)}
              className="min-w-0 flex-1 rounded border border-(--border) bg-(--surface) px-1.5 py-1 text-[12px] text-(--fg) outline-none"
            >
              <option value="">不设置</option>
              {options.map((attribute) => <option key={attribute.id} value={attribute.id}>{attribute.name}</option>)}
            </select>
            <button type="button" disabled={!rule} onClick={onToggleDirection} title={rule?.direction === "desc" ? "降序" : "升序"} aria-label={rule?.direction === "desc" ? "切换为升序" : "切换为降序"} className="grid size-6 flex-none place-items-center rounded border-none bg-transparent text-(--muted) disabled:opacity-40 hover:bg-(--surface-2) hover:text-(--fg)">
              {rule?.direction === "desc" ? <ChevDownIcon /> : <ChevUpIcon />}
            </button>
          </div>
          {options.length === 0 && <div className="px-1 py-1 text-[11.5px] text-(--muted-2)">暂无可排序属性</div>}
          {isSortRuleActive(rule) && !manual && <button type="button" onClick={onRestore} className="mt-1 w-full rounded-(--r-sm) border-none bg-transparent py-1 text-[11.5px] text-(--muted) hover:bg-(--surface-2)">恢复全局排序</button>}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef } from "react";
import type { Attribute, SortRule } from "../../types/schema";
import { sortableAttributes } from "../../lib/requirementSort";

interface GlobalSortPanelProps {
  attributes: Attribute[];
  sort: SortRule | null;
  onChange: (sort: SortRule | null) => void;
  onClose: () => void;
}

export function GlobalSortPanel({ attributes, sort, onChange, onClose }: GlobalSortPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const options = sortableAttributes(attributes);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={rootRef} className="absolute top-10 right-24 z-50 w-60 rounded-(--r-lg) border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) p-2 shadow-(--shadow-floating)" onClick={(event) => event.stopPropagation()}>
      <div className="mb-1 px-1 text-[11px] font-[550] text-(--module-scope-text-tertiary)">全局排序</div>
      <div className="flex items-center gap-1.5 px-0.5 py-1">
        <select
          aria-label="全局排序字段"
          value={sort?.attrId ?? ""}
          onChange={(event) => onChange(event.target.value ? { attrId: event.target.value, direction: sort?.direction ?? "asc" } : null)}
          className="min-w-0 flex-1 rounded border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-1.5 py-1 text-[12px] text-(--module-scope-text-primary) outline-none"
        >
          <option value="">不设置</option>
          {options.map((attribute) => <option key={attribute.id} value={attribute.id}>{attribute.name}</option>)}
        </select>
        <select
          aria-label="全局排序方向"
          disabled={!sort}
          value={sort?.direction ?? "asc"}
          onChange={(event) => { if (sort) onChange({ ...sort, direction: event.target.value as SortRule["direction"] }); }}
          className="w-18 rounded border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-1.5 py-1 text-[12px] text-(--module-scope-text-primary) outline-none disabled:opacity-40"
        >
          <option value="asc">升序</option>
          <option value="desc">降序</option>
        </select>
      </div>
      {options.length === 0 && <div className="px-1 py-1 text-[11.5px] text-(--module-scope-text-tertiary)">暂无可排序属性</div>}
      {sort && <button type="button" onClick={() => onChange(null)} className="mt-1 w-full rounded-(--r-sm) border-none bg-transparent py-1 text-[11.5px] text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft)">清除全局排序</button>}
    </div>
  );
}

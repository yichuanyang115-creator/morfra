import { useEffect, useRef, useState } from "react";
import type { FieldSummary } from "../../../types/domain";
import { isCompleteCondition, isSortableField, type ViewPipelineConfig } from "../../../lib/table/viewPipeline";
import { ConditionalColorPanel } from "./ConditionalColorPanel";
import { FilterPanel } from "./FilterPanel";
import { GroupPanel } from "./GroupPanel";
import { SortPanel } from "./SortPanel";
import { Panel } from "./viewToolShared";

interface ViewToolsProps {
  fields: FieldSummary[];
  visibleFieldIds?: string[];
  config: ViewPipelineConfig;
  search: string;
  rowHeight: 32 | 40 | 56;
  onSearchChange: (value: string) => void;
  onRowHeightChange: (value: 32 | 40 | 56) => void;
  onChange: (config: ViewPipelineConfig) => void;
  onCreateRecord?: () => void;
  boardMode?: boolean;
}

type OpenTool = "filter" | "sort" | "group" | "color" | "rowHeight" | null;

export function ViewTools(props: ViewToolsProps) {
  const { fields, visibleFieldIds, config, search, rowHeight, onSearchChange, onRowHeightChange, onChange, onCreateRecord, boardMode = false } = props;
  const [open, setOpen] = useState<OpenTool>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const close = (restoreFocus = true) => { const tool = open; setOpen(null); if (restoreFocus && tool) triggerRefs.current[tool]?.focus(); };
  useEffect(() => { const outside = (event: PointerEvent) => { if (open && !(event.target as Element).closest(".morfra-view-tool-anchor, .morfra-view-tool-panel, .morfra-color-palette")) close(); }; document.addEventListener("pointerdown", outside); return () => document.removeEventListener("pointerdown", outside); }, [open]);
  useEffect(() => { const closeTools = () => setOpen(null); window.addEventListener("morfra-close-view-tools", closeTools); return () => window.removeEventListener("morfra-close-view-tools", closeTools); }, []);
  const validFilterCount = config.filters.filter((filter) => isCompleteCondition(filter, fields)).length;
  const validSortCount = config.sorts.filter((sort, index, all) => isSortableField(fields.find((field) => field.id === sort.fieldId)) && all.findIndex((item) => item.fieldId === sort.fieldId) === index).length;
  const validColorCount = config.conditionalColors.filter((rule) => isCompleteCondition(rule, fields)).length;
  const toggle = (tool: Exclude<OpenTool, null>) => { if (open === tool) close(true); else { window.dispatchEvent(new Event("morfra-close-field-manager")); setOpen(tool); } };
  return <div className="morfra-view-toolbar-actions">
    <label className="morfra-view-search">
      <span className="sr-only">搜索当前视图</span>
      <input aria-label="搜索当前视图" value={search} placeholder="搜索" onChange={(event) => onSearchChange(event.target.value)} />
      {search && <button type="button" aria-label="清除搜索" onClick={() => onSearchChange("")}>×</button>}
    </label>
    <ToolAnchor tool="filter" label="筛选" active={validFilterCount > 0} count={validFilterCount} open={open === "filter"} triggerRefs={triggerRefs} onClick={() => toggle("filter")}>{open === "filter" && <FilterPanel fields={fields} visibleFieldIds={visibleFieldIds} config={config} onChange={onChange} onClose={close} anchor={triggerRefs.current.filter} />}</ToolAnchor>
    <ToolAnchor tool="sort" label="排序" active={validSortCount > 0} count={validSortCount} open={open === "sort"} triggerRefs={triggerRefs} onClick={() => toggle("sort")}>{open === "sort" && <SortPanel fields={fields} visibleFieldIds={visibleFieldIds} config={config} onChange={onChange} onClose={close} anchor={triggerRefs.current.sort} />}</ToolAnchor>
    {!boardMode && <ToolAnchor tool="group" label="分组" active={Boolean(config.group.fieldId)} open={open === "group"} triggerRefs={triggerRefs} onClick={() => toggle("group")}>{open === "group" && <GroupPanel fields={fields} visibleFieldIds={visibleFieldIds} config={config} onChange={onChange} onClose={close} anchor={triggerRefs.current.group} />}</ToolAnchor>}
    {!boardMode && <ToolAnchor tool="color" label="条件填色" active={validColorCount > 0} count={validColorCount} open={open === "color"} triggerRefs={triggerRefs} onClick={() => toggle("color")}>{open === "color" && <ConditionalColorPanel fields={fields} visibleFieldIds={visibleFieldIds} config={config} onChange={onChange} onClose={close} anchor={triggerRefs.current.color} />}</ToolAnchor>}
    {!boardMode && <ToolAnchor tool="rowHeight" label="行高" active={false} open={open === "rowHeight"} triggerRefs={triggerRefs} onClick={() => toggle("rowHeight")}>{open === "rowHeight" && <RowHeightPanel value={rowHeight} onChange={onRowHeightChange} onClose={close} anchor={triggerRefs.current.rowHeight} />}</ToolAnchor>}
    {!boardMode && onCreateRecord && <button type="button" className="morfra-view-create-record" onClick={onCreateRecord}>新建记录</button>}
  </div>;
}

function ToolAnchor({ tool, label, active, count, open, triggerRefs, onClick, children }: { tool: string; label: string; active: boolean; count?: number; open: boolean; triggerRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>; onClick: () => void; children: React.ReactNode }) { return <div className="morfra-view-tool-anchor"><button ref={(node) => { triggerRefs.current[tool] = node; }} type="button" className={active || open ? "is-active" : ""} aria-pressed={open} aria-haspopup="dialog" aria-expanded={open} aria-label={count ? `${label}，${count} 项` : label} onClick={onClick}>{label}{count ? <span aria-hidden="true"> {count}</span> : null}</button>{children}</div>; }

const ROW_HEIGHT_OPTIONS = [{ value: 32, label: "紧凑" }, { value: 40, label: "标准" }, { value: 56, label: "宽松" }] as const;

function RowHeightPanel({ value, onChange, onClose, anchor }: { value: 32 | 40 | 56; onChange: (value: 32 | 40 | 56) => void; onClose: () => void; anchor: HTMLElement | null }) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { menuRef.current?.querySelector<HTMLButtonElement>(`[data-row-height="${value}"]`)?.focus(); }, [value]);
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']") ?? [])];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };
  return <Panel title="行高" onClose={onClose} compact titleHidden anchor={anchor}><div ref={menuRef} className="morfra-row-height-menu" role="menu" aria-label="行高选项" onKeyDown={handleMenuKeyDown}>
      {ROW_HEIGHT_OPTIONS.map((option) => <button key={option.value} type="button" role="menuitemradio" data-row-height={option.value} aria-checked={value === option.value} onClick={() => { onChange(option.value); onClose(); }}><span aria-hidden="true" className="morfra-row-height-check">{value === option.value ? "✓" : ""}</span>{option.label}</button>)}
    </div></Panel>;
}

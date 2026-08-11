import { useState } from "react";
import type { FieldSummary } from "../../../types/domain";
import type { ViewPipelineConfig } from "../../../lib/table/viewPipeline";
import { ConditionalColorPanel } from "./ConditionalColorPanel";
import { FilterPanel } from "./FilterPanel";
import { GroupPanel } from "./GroupPanel";
import { SortPanel } from "./SortPanel";
import { Panel } from "./viewToolShared";

interface ViewToolsProps {
  fields: FieldSummary[];
  visibleFieldCount: number;
  config: ViewPipelineConfig;
  search: string;
  rowHeight: 32 | 40 | 56;
  onSearchChange: (value: string) => void;
  onRowHeightChange: (value: 32 | 40 | 56) => void;
  onChange: (config: ViewPipelineConfig) => void;
  onOpenFieldDisplay: () => void;
  boardMode?: boolean;
}

type OpenTool = "filter" | "sort" | "group" | "color" | "more" | null;

export function ViewTools(props: ViewToolsProps) {
  const { fields, visibleFieldCount, config, search, rowHeight, onSearchChange, onRowHeightChange, onChange, onOpenFieldDisplay, boardMode = false } = props;
  const [open, setOpen] = useState<OpenTool>(null);
  const close = () => setOpen(null);
  const hiddenFieldCount = Math.max(0, fields.length - visibleFieldCount);
  const toggle = (tool: Exclude<OpenTool, null>) => setOpen(open === tool ? null : tool);
  return <div className="morfra-view-toolbar-actions">
    <label className="morfra-view-search">
      <span className="sr-only">搜索当前视图</span>
      <input aria-label="搜索当前视图" value={search} placeholder="搜索" onChange={(event) => onSearchChange(event.target.value)} />
      {search && <button type="button" aria-label="清除搜索" onClick={() => onSearchChange("")}>×</button>}
    </label>
    <ToolButton label="筛选" active={config.filters.length > 0} count={config.filters.length} onClick={() => toggle("filter")} />
    <ToolButton label="排序" active={config.sorts.length > 0} count={config.sorts.length} onClick={() => toggle("sort")} />
    {!boardMode && <ToolButton label="分组" active={Boolean(config.group.fieldId)} onClick={() => toggle("group")} />}
    {!boardMode && <ToolButton className="morfra-view-secondary-tool" label="条件填色" active={config.conditionalColors.some((rule) => rule.enabled)} count={config.conditionalColors.length} onClick={() => toggle("color")} />}
    {!boardMode && <RowHeightSelect label="行高" value={rowHeight} onChange={onRowHeightChange} />}
    {!boardMode && <ToolButton className="morfra-view-secondary-tool" label="字段显示" active={hiddenFieldCount > 0} count={hiddenFieldCount} onClick={onOpenFieldDisplay} />}
    <button type="button" className="morfra-view-more-trigger" aria-label="更多视图工具" onClick={() => toggle("more")}>更多</button>
    {open === "filter" && <FilterPanel fields={fields} config={config} onChange={onChange} onClose={close} />}
    {open === "sort" && <SortPanel fields={fields} config={config} onChange={onChange} onClose={close} />}
    {!boardMode && open === "group" && <GroupPanel fields={fields} config={config} onChange={onChange} onClose={close} />}
    {!boardMode && open === "color" && <ConditionalColorPanel fields={fields} config={config} onChange={onChange} onClose={close} />}
    {open === "more" && <Panel title="更多视图工具" onClose={close}>
      {!boardMode && <><button type="button" onClick={() => setOpen("color")}>条件填色{config.conditionalColors.length ? ` (${config.conditionalColors.length})` : ""}</button><RowHeightSelect label="更多菜单行高" value={rowHeight} onChange={onRowHeightChange} /><button type="button" onClick={() => { onOpenFieldDisplay(); close(); }}>字段显示{hiddenFieldCount ? ` (${hiddenFieldCount})` : ""}</button></>}
    </Panel>}
  </div>;
}

function ToolButton({ label, active, count, onClick, className }: { label: string; active: boolean; count?: number; onClick: () => void; className?: string }) {
  return <button type="button" className={`${className ?? ""} ${active ? "is-active" : ""}`} aria-pressed={active} onClick={onClick}>
    {label}{count ? <span aria-label={`${count} 项`}> {count}</span> : null}
  </button>;
}

function RowHeightSelect({ label, value, onChange }: { label: string; value: 32 | 40 | 56; onChange: (value: 32 | 40 | 56) => void }) {
  return <label className="morfra-view-row-height">{label}<select aria-label={label} value={value} onChange={(event) => onChange(Number(event.target.value) as 32 | 40 | 56)}>
    <option value="32">紧凑</option><option value="40">标准</option><option value="56">宽松</option>
  </select></label>;
}

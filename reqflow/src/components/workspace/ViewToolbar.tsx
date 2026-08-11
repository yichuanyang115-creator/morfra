import type { FieldSummary, ViewSummary } from "../../types/domain";
import type { ViewPipelineConfig } from "../../lib/table/viewPipeline";
import { ViewTools } from "../table/tools/ViewTools";

interface ViewToolbarProps {
  view: ViewSummary;
  fields?: FieldSummary[];
  visibleFieldCount?: number;
  pipeline?: ViewPipelineConfig;
  search?: string;
  rowHeight?: 32 | 40 | 56;
  onSearchChange?: (value: string) => void;
  onRowHeightChange?: (value: 32 | 40 | 56) => void;
  onPipelineChange?: (pipeline: ViewPipelineConfig) => void;
  onOpenFieldDisplay?: () => void;
  boardMode?: boolean;
}

export function ViewToolbar({ view, fields, visibleFieldCount, pipeline, search, rowHeight, onSearchChange, onRowHeightChange, onPipelineChange, onOpenFieldDisplay, boardMode = false }: ViewToolbarProps) {
  return <div className="morfra-view-toolbar" aria-label="当前视图工具栏">
    <div className="morfra-view-toolbar-main"><span className="morfra-view-type-icon" aria-hidden="true">{view.viewType === "board" ? "▤" : "▦"}</span><span>{view.viewType === "board" ? "看板视图" : "表格视图"}</span></div>
    {fields && pipeline && onSearchChange && onRowHeightChange && onPipelineChange && onOpenFieldDisplay ? <ViewTools fields={fields} visibleFieldCount={visibleFieldCount ?? fields.length} config={pipeline} search={search ?? ""} rowHeight={rowHeight ?? 40} onSearchChange={onSearchChange} onRowHeightChange={onRowHeightChange} onChange={onPipelineChange} onOpenFieldDisplay={onOpenFieldDisplay} boardMode={boardMode} /> : <div className="morfra-view-toolbar-actions"><span className="morfra-toolbar-hint">正在读取视图配置…</span></div>}
  </div>;
}

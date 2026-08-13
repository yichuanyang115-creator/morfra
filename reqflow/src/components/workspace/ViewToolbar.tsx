import type { FieldSummary, ViewSummary } from "../../types/domain";
import type { ReactNode } from "react";
import type { ViewPipelineConfig } from "../../lib/table/viewPipeline";
import { ViewTools } from "../table/tools/ViewTools";

interface ViewToolbarProps {
  view: ViewSummary;
  fields?: FieldSummary[];
  visibleFieldCount?: number;
  visibleFieldIds?: string[];
  pipeline?: ViewPipelineConfig;
  search?: string;
  rowHeight?: 32 | 40 | 56;
  onSearchChange?: (value: string) => void;
  onRowHeightChange?: (value: 32 | 40 | 56) => void;
  onPipelineChange?: (pipeline: ViewPipelineConfig) => void;
  onOpenFieldDisplay?: () => void;
  renderFieldDisplayPanel?: (onClose: () => void) => ReactNode;
  fieldDisplayActive?: boolean;
  onCreateRecord?: () => void;
  boardMode?: boolean;
}

export function ViewToolbar({ fields, visibleFieldCount, visibleFieldIds, pipeline, search, rowHeight, onSearchChange, onRowHeightChange, onPipelineChange, onOpenFieldDisplay, renderFieldDisplayPanel, fieldDisplayActive, onCreateRecord, boardMode = false }: ViewToolbarProps) {
  return <div className="morfra-view-toolbar" aria-label="当前视图工具栏">
    {fields && pipeline && onSearchChange && onRowHeightChange && onPipelineChange && onOpenFieldDisplay ? <ViewTools fields={fields} visibleFieldCount={visibleFieldCount ?? fields.length} visibleFieldIds={visibleFieldIds} config={pipeline} search={search ?? ""} rowHeight={rowHeight ?? 40} onSearchChange={onSearchChange} onRowHeightChange={onRowHeightChange} onChange={onPipelineChange} onOpenFieldDisplay={onOpenFieldDisplay} renderFieldDisplayPanel={renderFieldDisplayPanel} fieldDisplayActive={fieldDisplayActive} onCreateRecord={onCreateRecord} boardMode={boardMode} /> : <div className="morfra-view-toolbar-actions"><span className="morfra-toolbar-hint">正在读取视图配置…</span></div>}
  </div>;
}

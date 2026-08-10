import type { ViewSummary } from "../../types/domain";

interface ViewToolbarProps {
  view: ViewSummary;
  onOpenFieldDisplay?: () => void;
}

export function ViewToolbar({ view, onOpenFieldDisplay }: ViewToolbarProps) {
  return <div className="morfra-view-toolbar" aria-label="当前视图工具栏">
    <div className="morfra-view-toolbar-main"><span className="morfra-view-type-icon" aria-hidden="true">{view.viewType === "board" ? "▤" : "▦"}</span><span>{view.viewType === "board" ? "看板视图" : "表格视图"}</span></div>
    <div className="morfra-view-toolbar-actions"><button type="button" disabled aria-label="筛选">筛选</button><button type="button" disabled aria-label="排序">排序</button><button type="button" disabled aria-label="分组">分组</button>{onOpenFieldDisplay && <button type="button" aria-label="字段显示" onClick={onOpenFieldDisplay}>字段显示</button>}<span className="morfra-toolbar-hint">视图配置即将可用</span></div>
  </div>;
}

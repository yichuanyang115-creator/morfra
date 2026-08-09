import type { ReactNode } from "react";
import type { RightPanelMode, WindowLayout } from "../../lib/layout/windowLayout";
import type { ActiveRightPanel } from "../../stores/layoutStore";
import { LayoutResizer } from "./LayoutResizer";

interface RightPanelHostProps {
  layout: WindowLayout;
  activePanel: ActiveRightPanel;
  detailOpen: boolean;
  aiOpen: boolean;
  detailContent: ReactNode;
  aiContent: ReactNode;
  onCloseDetail: () => void;
  onCloseAi: () => void;
  onSelectPanel: (panel: ActiveRightPanel) => void;
  onResizeDetail: (width: number) => void;
  onResizeAi: (width: number) => void;
  navigationOverlayOpen?: boolean;
}

function PanelCloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="morfra-panel-close" aria-label={`关闭${label}`} onClick={onClick}>×</button>;
}

function PanelHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return <div className="morfra-panel-header"><span>{label}</span><PanelCloseButton label={label} onClick={onClose} /></div>;
}

function Panel({ className = "", label, children, onClose }: { className?: string; label: string; children: ReactNode; onClose: () => void }) {
  return <aside className={`morfra-right-panel ${className}`} aria-label={label}><PanelHeader label={label} onClose={onClose} /><div className="morfra-panel-content">{children}</div></aside>;
}

function MergedPanel({ activePanel, detailContent, aiContent, detailOpen, aiOpen, onCloseDetail, onCloseAi, onSelectPanel }: Omit<RightPanelHostProps, "layout" | "onResizeDetail" | "onResizeAi" | "navigationOverlayOpen">) {
  const visiblePanel = activePanel === "ai" && aiOpen ? "ai" : detailOpen ? "detail" : "ai";
  return (
    <aside className="morfra-right-panel morfra-right-panel-merged" aria-label="上下文面板">
      <div className="morfra-panel-tabs" role="tablist" aria-label="上下文面板切换">
        <button type="button" role="tab" aria-selected={visiblePanel === "detail"} className={visiblePanel === "detail" ? "is-active" : ""} onClick={() => onSelectPanel("detail")}>详情</button>
        <button type="button" role="tab" aria-selected={visiblePanel === "ai"} className={visiblePanel === "ai" ? "is-active" : ""} onClick={() => onSelectPanel("ai")}>AI</button>
      </div>
      <div className="morfra-panel-content">
        <div className={visiblePanel === "detail" ? "" : "is-hidden"} aria-hidden={visiblePanel !== "detail"}>
          <PanelHeader label="记录详情" onClose={onCloseDetail} />
          {detailContent}
        </div>
        <div className={visiblePanel === "ai" ? "" : "is-hidden"} aria-hidden={visiblePanel !== "ai"}>
          <PanelHeader label="AI 表格助手" onClose={onCloseAi} />
          {aiContent}
        </div>
      </div>
    </aside>
  );
}

export function RightPanelHost({ layout, navigationOverlayOpen = false, ...props }: RightPanelHostProps) {
  if (navigationOverlayOpen) return null;
  const mode: RightPanelMode = layout.rightPanelMode;
  if (mode === "none") return null;
  if (mode === "dual") {
    return <><LayoutResizer className="morfra-panel-resizer" label="调整记录详情宽度" width={layout.detailWidth} direction="decrease" onResize={props.onResizeDetail} /><Panel className="morfra-detail-panel" label="记录详情" onClose={props.onCloseDetail}>{props.detailContent}</Panel><LayoutResizer className="morfra-panel-resizer" label="调整 AI 面板宽度" width={layout.aiWidth} direction="decrease" onResize={props.onResizeAi} /><Panel className="morfra-ai-panel" label="AI 表格助手" onClose={props.onCloseAi}>{props.aiContent}</Panel></>;
  }
  if (mode === "merged" || mode === "single") {
    return <><LayoutResizer className="morfra-panel-resizer" label={`调整${props.activePanel === "ai" ? "AI 面板" : "记录详情"}宽度`} width={layout.rightPanelWidth} direction="decrease" onResize={(width) => props.activePanel === "ai" ? props.onResizeAi(width) : props.onResizeDetail(width)} /><MergedPanel {...props} /></>;
  }
  return <div className="morfra-drawer-layer"><button type="button" className="morfra-drawer-scrim" aria-label="关闭上下文面板" onClick={props.activePanel === "ai" ? props.onCloseAi : props.onCloseDetail} /><div className="morfra-drawer-panel"><MergedPanel {...props} /></div></div>;
}

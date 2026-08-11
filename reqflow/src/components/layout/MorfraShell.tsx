import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { currentProject, useProjectStore } from "../../stores/projectStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { calculateWindowLayout, PANEL_RESIZER_WIDTH, type WindowLayout } from "../../lib/layout/windowLayout";
import { useLayoutStore, type AppearanceMode } from "../../stores/layoutStore";
import { applyAccessibilityPreferences, applyAppearanceMode, subscribeToAccessibilityPreferences, subscribeToSystemAppearance } from "../../lib/layout/appearance";
import { WindowTitlebar } from "./WindowTitlebar";
import { RightPanelHost } from "./RightPanelHost";
import { LayoutResizer } from "./LayoutResizer";
import { ProjectSwitcher } from "../sidebar/ProjectSwitcher";
import { TableList } from "../sidebar/TableList";
import { StorageRecordDetailPanel } from "../storage/RecordDetailPanel";
import { StorageAICascade, StorageAIHost, StorageAIPreferenceMigration } from "../storage/StorageAIHost";
import { AIServiceSettings } from "../app-settings/AIServiceSettings";

interface MorfraShellProps {
  mainContent: ReactNode;
}

function ProjectSidebar({ onProjectSelected }: { onProjectSelected?: () => void }) {
  const project = useProjectStore(currentProject);
  const canUndo = useProjectStore((state) => state.canUndo);
  const createTable = useProjectStore((state) => state.createTable);
  const renameTable = useProjectStore((state) => state.renameTable);
  const deleteTable = useProjectStore((state) => state.deleteTable);
  const reorderTables = useProjectStore((state) => state.reorderTables);
  const undoStorageChange = useProjectStore((state) => state.undoStorageChange);
  const activeTableId = useWorkspaceStore((state) => project ? state.activeTableByProject[project.id] ?? null : null);
  const setActiveTable = useWorkspaceStore((state) => state.setActiveTable);
  const tables = project?.storageSnapshot?.tables ?? [];

  return (
    <aside className="morfra-sidebar" data-testid="morfra-sidebar" aria-label="项目导航">
      {project?.storageSnapshot && <div className="morfra-sidebar-scope">Morfra 本地项目包</div>}
      <div className="morfra-sidebar-heading"><span>项目</span></div>
      <ProjectSwitcher onProjectSelected={onProjectSelected} closeOnClick={Boolean(onProjectSelected)} />
      {project ? <TableList tables={tables} activeTableId={activeTableId} canUndo={canUndo} onSelect={(id) => setActiveTable(project.id, id)} onCreate={createTable} onRename={renameTable} onDelete={deleteTable} onReorder={reorderTables} onUndo={undoStorageChange} /> : <div className="morfra-sidebar-empty">没有打开的项目</div>}
    </aside>
  );
}

function viewportSize(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function cycleAppearance(mode: AppearanceMode): AppearanceMode {
  return mode === "system" ? "light" : mode === "light" ? "dark" : "system";
}

export function MorfraShell({ mainContent }: MorfraShellProps) {
  const project = useProjectStore(currentProject);
  const hydrated = useLayoutStore((state) => state.hydrated);
  const hydrate = useLayoutStore((state) => state.hydrate);
  const sidebarOpen = useLayoutStore((state) => state.sidebarOpen);
  const sidebarWidth = useLayoutStore((state) => state.sidebarWidth);
  const detailOpen = useLayoutStore((state) => state.detailOpen);
  const detailWidth = useLayoutStore((state) => state.detailWidth);
  const aiOpen = useLayoutStore((state) => state.aiOpen);
  const aiWidth = useLayoutStore((state) => state.aiWidth);
  const activeRightPanel = useLayoutStore((state) => state.activeRightPanel);
  const appearanceMode = useLayoutStore((state) => state.appearanceMode);
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);
  const toggleDetail = useLayoutStore((state) => state.toggleDetail);
  const toggleAi = useLayoutStore((state) => state.toggleAi);
  const setSidebarWidth = useLayoutStore((state) => state.setSidebarWidth);
  const setDetailWidth = useLayoutStore((state) => state.setDetailWidth);
  const setAiWidth = useLayoutStore((state) => state.setAiWidth);
  const setActiveRightPanel = useLayoutStore((state) => state.setActiveRightPanel);
  const setAppearanceMode = useLayoutStore((state) => state.setAppearanceMode);
  const [viewport, setViewport] = useState(viewportSize);
  const [narrowSidebarOpen, setNarrowSidebarOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    function handleResize() {
      setViewport(viewportSize());
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const openSettings = () => setAiSettingsOpen(true);
    window.addEventListener("open-ai-service-settings", openSettings);
    return () => window.removeEventListener("open-ai-service-settings", openSettings);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyAppearanceMode(appearanceMode);
    applyAccessibilityPreferences();
    const unsubscribeAppearance = subscribeToSystemAppearance(() => applyAppearanceMode(appearanceMode));
    const unsubscribeAccessibility = subscribeToAccessibilityPreferences(applyAccessibilityPreferences);
    return () => {
      unsubscribeAppearance();
      unsubscribeAccessibility();
    };
  }, [appearanceMode, hydrated]);

  const layout: WindowLayout = useMemo(() => calculateWindowLayout({ viewportWidth: viewport.width, viewportHeight: viewport.height, sidebarOpen, sidebarWidth, detailOpen, detailWidth, aiOpen, aiWidth, activeRightPanel }), [activeRightPanel, aiOpen, aiWidth, detailOpen, detailWidth, sidebarOpen, sidebarWidth, viewport.height, viewport.width]);
  const gridTemplateColumns = layout.mode === "narrow"
    ? `${layout.sidebarWidth}px minmax(0, 1fr)`
    : `${layout.sidebarWidth}px ${sidebarOpen ? `${PANEL_RESIZER_WIDTH}px ` : ""}minmax(0, 1fr) ${layout.rightPanelMode === "dual" ? `${PANEL_RESIZER_WIDTH}px ${layout.detailWidth}px ${PANEL_RESIZER_WIDTH}px ${layout.aiWidth}px` : layout.rightPanelWidth ? `${PANEL_RESIZER_WIDTH}px ${layout.rightPanelWidth}px` : "0px"}`;
  const handleToggleSidebar = () => {
    if (layout.mode === "narrow") {
      setNarrowSidebarOpen((open) => !open);
      return;
    }
    toggleSidebar();
  };
  const handleToggleAi = () => {
    if (layout.mode === "narrow") setNarrowSidebarOpen(false);
    setActiveRightPanel("ai");
    toggleAi();
  };

  return (
    <div className="morfra-shell" data-testid="morfra-shell" data-window-mode={layout.mode} data-sidebar-open={sidebarOpen} data-right-panel-mode={layout.rightPanelMode} style={{ "--morfra-sidebar-width": `${layout.sidebarWidth}px`, "--morfra-right-panel-width": `${layout.rightPanelWidth}px` } as CSSProperties}>
      <StorageAICascade />
      <StorageAIPreferenceMigration />
      <WindowTitlebar projectName={project?.name ?? null} sidebarOpen={layout.mode === "narrow" ? narrowSidebarOpen : sidebarOpen} aiOpen={aiOpen} appearanceMode={appearanceMode} onToggleSidebar={handleToggleSidebar} onToggleAi={handleToggleAi} onCycleAppearance={() => setAppearanceMode(cycleAppearance(appearanceMode))} />
      <div className="morfra-shell-body" style={{ gridTemplateColumns }}>
        <ProjectSidebar />
        {layout.mode === "regular" && sidebarOpen && <LayoutResizer className="morfra-sidebar-resizer" label="调整导航宽度" width={layout.sidebarWidth} direction="increase" onResize={setSidebarWidth} />}
        <main className="morfra-main" aria-label="主显示区">{mainContent}</main>
        <RightPanelHost layout={layout} activePanel={activeRightPanel} detailOpen={detailOpen} aiOpen={aiOpen} detailContent={<StorageRecordDetailPanel />} aiContent={<StorageAIHost onClose={toggleAi} />} onCloseDetail={toggleDetail} onCloseAi={toggleAi} onSelectPanel={setActiveRightPanel} onResizeDetail={setDetailWidth} onResizeAi={setAiWidth} navigationOverlayOpen={narrowSidebarOpen} />
      </div>
      {layout.mode === "narrow" && narrowSidebarOpen && <div className="morfra-sidebar-overlay"><button type="button" className="morfra-sidebar-overlay-scrim" aria-label="关闭项目导航" onClick={() => setNarrowSidebarOpen(false)} /><div className="morfra-sidebar-overlay-panel"><ProjectSidebar onProjectSelected={() => setNarrowSidebarOpen(false)} /></div></div>}
      {aiSettingsOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-6"><button type="button" aria-label="关闭 AI 服务设置" className="absolute inset-0 border-none bg-(--overlay-scrim)" onClick={() => setAiSettingsOpen(false)} /><section role="dialog" aria-modal="true" aria-label="AI 服务设置" className="relative flex max-h-[min(760px,calc(100vh-48px))] w-[min(860px,calc(100vw-48px))] flex-col overflow-hidden rounded-(--r-lg) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) shadow-(--shadow-panel)"><div className="flex flex-none items-center justify-between border-b border-(--module-scope-border-subtle) px-4 py-2.5"><strong className="text-[14px] font-[590]">AI 服务设置</strong><button type="button" aria-label="关闭 AI 服务设置" className="grid size-7 place-items-center rounded-(--r-sm) border-none bg-transparent text-[17px] text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft)" onClick={() => setAiSettingsOpen(false)}>×</button></div><AIServiceSettings /></section></div>}
    </div>
  );
}

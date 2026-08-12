import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { currentProject, useProjectStore } from "../../stores/projectStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { calculateWindowLayout, PANEL_RESIZER_WIDTH, type WindowLayout } from "../../lib/layout/windowLayout";
import { useLayoutStore } from "../../stores/layoutStore";
import { applyAccessibilityPreferences, applyAppearanceMode, subscribeToAccessibilityPreferences, subscribeToSystemAppearance } from "../../lib/layout/appearance";
import { WindowTitlebar } from "./WindowTitlebar";
import { RightPanelHost } from "./RightPanelHost";
import { LayoutResizer } from "./LayoutResizer";
import { ProjectSwitcher } from "../sidebar/ProjectSwitcher";
import { TableList } from "../sidebar/TableList";
import { StorageRecordDetailPanel } from "../storage/RecordDetailPanel";
import { StorageAICascade, StorageAIHost } from "../storage/StorageAIHost";
import { AppSettingsPage } from "../app-settings/AppSettingsPage";
import { useAIProviderStore } from "../../stores/aiProviderStore";
import { isTauriRuntime } from "../../lib/ipc/storageClient";
import { open as openDirectoryDialog } from "@tauri-apps/plugin-dialog";

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
  const setAiOpen = useLayoutStore((state) => state.setAiOpen);
  const setProviderPanelOpen = useAIProviderStore((state) => state.setPanelOpen);
  const setSidebarWidth = useLayoutStore((state) => state.setSidebarWidth);
  const setDetailWidth = useLayoutStore((state) => state.setDetailWidth);
  const setAiWidth = useLayoutStore((state) => state.setAiWidth);
  const setActiveRightPanel = useLayoutStore((state) => state.setActiveRightPanel);
  const createProject = useProjectStore((state) => state.createProject);
  const openProject = useProjectStore((state) => state.openProject);
  const [viewport, setViewport] = useState(viewportSize);
  const [narrowSidebarOpen, setNarrowSidebarOpen] = useState(false);
  const [appSettingsSection, setAppSettingsSection] = useState<"appearance" | "ai-service" | "version" | null>(null);
  const [aiCompleted, setAiCompleted] = useState(false);

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
    if (!isTauriRuntime()) return;
    let disposed = false;
    const stops: Array<() => void> = [];
    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      const stopNew = await listen("morfra-new-project", () => {
        if (disposed) return;
        const name = window.prompt("新建项目名称", "未命名项目")?.trim();
        if (name) void createProject(name);
      });
      const stopOpen = await listen("morfra-open-project", () => {
        if (disposed) return;
        void openDirectoryDialog({ directory: true, multiple: false, title: "打开 Morfra 项目" }).then((selected) => {
          if (typeof selected === "string") return openProject(selected);
        });
      });
      if (disposed) {
        stopNew();
        stopOpen();
      } else {
        stops.push(stopNew, stopOpen);
      }
    }).catch(() => undefined);
    return () => {
      disposed = true;
      stops.forEach((stop) => stop());
    };
  }, [createProject, openProject]);

  useEffect(() => {
    const handleCompleted = () => { if (!useLayoutStore.getState().aiOpen) setAiCompleted(true); };
    window.addEventListener("ai-generation-completed", handleCompleted);
    return () => window.removeEventListener("ai-generation-completed", handleCompleted);
  }, []);

  useEffect(() => {
    const openSettings = () => setAppSettingsSection("ai-service");
    window.addEventListener("open-ai-service-settings", openSettings);
    return () => window.removeEventListener("open-ai-service-settings", openSettings);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event").then(({ listen }) => listen<"appearance" | "ai-service" | "version">("morfra-open-settings", (event) => {
      if (!disposed) setAppSettingsSection(event.payload ?? "appearance");
    })).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    }).catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
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
    const nextOpen = !aiOpen;
    if (nextOpen) setAiCompleted(false);
    setAiOpen(nextOpen);
    void setProviderPanelOpen(nextOpen);
  };
  const handleCloseAi = () => {
    setAiOpen(false);
    void setProviderPanelOpen(false);
  };

  return (
    <div className="morfra-shell" data-testid="morfra-shell" data-window-mode={layout.mode} data-sidebar-open={sidebarOpen} data-right-panel-mode={layout.rightPanelMode} style={{ "--morfra-sidebar-width": `${layout.sidebarWidth}px`, "--morfra-right-panel-width": `${layout.rightPanelWidth}px` } as CSSProperties}>
      <StorageAICascade />
      <WindowTitlebar projectName={project?.name ?? null} sidebarOpen={layout.mode === "narrow" ? narrowSidebarOpen : sidebarOpen} aiOpen={aiOpen} aiCompleted={aiCompleted} onToggleSidebar={handleToggleSidebar} onToggleAi={handleToggleAi} />
      <div className="morfra-shell-body" style={{ gridTemplateColumns }}>
        <ProjectSidebar />
        {layout.mode === "regular" && sidebarOpen && <LayoutResizer className="morfra-sidebar-resizer" label="调整导航宽度" width={layout.sidebarWidth} direction="increase" onResize={setSidebarWidth} />}
        <main className="morfra-main" aria-label="主显示区">{mainContent}</main>
        <RightPanelHost layout={layout} activePanel={activeRightPanel} detailOpen={detailOpen} aiOpen={aiOpen} detailContent={<StorageRecordDetailPanel />} aiContent={<StorageAIHost />} onCloseDetail={toggleDetail} onCloseAi={handleCloseAi} onSelectPanel={setActiveRightPanel} onResizeDetail={setDetailWidth} onResizeAi={setAiWidth} navigationOverlayOpen={narrowSidebarOpen} />
      </div>
      {layout.mode === "narrow" && narrowSidebarOpen && <div className="morfra-sidebar-overlay"><button type="button" className="morfra-sidebar-overlay-scrim" aria-label="关闭项目导航" onClick={() => setNarrowSidebarOpen(false)} /><div className="morfra-sidebar-overlay-panel"><ProjectSidebar onProjectSelected={() => setNarrowSidebarOpen(false)} /></div></div>}
      {appSettingsSection && <div className="fixed inset-0 z-50 flex items-center justify-center p-6"><button type="button" aria-label="关闭应用设置" className="absolute inset-0 border-none bg-(--overlay-scrim)" onClick={() => setAppSettingsSection(null)} /><section role="dialog" aria-modal="true" aria-label="应用设置" className="relative flex h-[min(720px,calc(100vh-48px))] w-[min(960px,calc(100vw-48px))] overflow-hidden rounded-(--r-lg) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) shadow-(--shadow-panel)"><AppSettingsPage section={appSettingsSection} onSelectSection={setAppSettingsSection} onClose={() => setAppSettingsSection(null)} /></section></div>}
    </div>
  );
}

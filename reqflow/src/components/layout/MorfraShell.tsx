import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { currentProject, useProjectStore } from "../../stores/projectStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { calculateWindowLayout, PANEL_RESIZER_WIDTH, SIDEBAR_COLLAPSE_THRESHOLD, SIDEBAR_COMPACT_MIN_WIDTH, SIDEBAR_EXPAND_THRESHOLD, type WindowLayout } from "../../lib/layout/windowLayout";
import { useLayoutStore } from "../../stores/layoutStore";
import { applyAccessibilityPreferences, applyAppearanceMode, subscribeToAccessibilityPreferences, subscribeToSystemAppearance } from "../../lib/layout/appearance";
import { WindowTitlebar } from "./WindowTitlebar";
import { RightPanelHost } from "./RightPanelHost";
import { LayoutResizer } from "./LayoutResizer";
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

function ProjectSidebar({ mode = "expanded", createRequest = 0, onTableSelected }: { mode?: "expanded" | "compact" | "collapsed"; createRequest?: number; onTableSelected?: () => void }) {
  const project = useProjectStore(currentProject);
  const createTable = useProjectStore((state) => state.createTable);
  const renameTable = useProjectStore((state) => state.renameTable);
  const updateTableEmoji = useProjectStore((state) => state.updateTableEmoji);
  const deleteTable = useProjectStore((state) => state.deleteTable);
  const reorderTables = useProjectStore((state) => state.reorderTables);
  const activeTableId = useWorkspaceStore((state) => project ? state.activeTableByProject[project.id] ?? null : null);
  const setActiveTable = useWorkspaceStore((state) => state.setActiveTable);
  const tables = project?.storageSnapshot?.tables ?? [];

  return (
    <aside className={`morfra-sidebar${mode === "collapsed" ? " is-collapsed" : ""}`} data-testid="morfra-sidebar" aria-label="项目导航">
      {project ? <TableList tables={tables} activeTableId={activeTableId} compact={mode === "collapsed"} createRequest={createRequest} onSelect={(id) => { setActiveTable(project.id, id); onTableSelected?.(); }} onCreate={async (name) => { await createTable(name); const createdTables = currentProject(useProjectStore.getState())?.storageSnapshot?.tables ?? []; const created = createdTables[createdTables.length - 1]; if (created) setActiveTable(project.id, created.id); }} onRename={renameTable} onEmojiChange={updateTableEmoji} onDelete={deleteTable} onReorder={reorderTables} /> : mode !== "collapsed" && <div className="morfra-sidebar-empty">没有打开的表</div>}
    </aside>
  );
}

function viewportSize(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

export function MorfraShell({ mainContent }: MorfraShellProps) {
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
  const setSidebarOpen = useLayoutStore((state) => state.setSidebarOpen);
  const toggleDetail = useLayoutStore((state) => state.toggleDetail);
  const setAiOpen = useLayoutStore((state) => state.setAiOpen);
  const setProviderPanelOpen = useAIProviderStore((state) => state.setPanelOpen);
  const setSidebarWidth = useLayoutStore((state) => state.setSidebarWidth);
  const setDetailWidth = useLayoutStore((state) => state.setDetailWidth);
  const setAiWidth = useLayoutStore((state) => state.setAiWidth);
  const setActiveRightPanel = useLayoutStore((state) => state.setActiveRightPanel);
  const createProject = useProjectStore((state) => state.createProject);
  const openProject = useProjectStore((state) => state.openProject);
  const canUndo = useProjectStore((state) => state.canUndo);
  const undoStorageChange = useProjectStore((state) => state.undoStorageChange);
  const [viewport, setViewport] = useState(viewportSize);
  const [narrowSidebarOpen, setNarrowSidebarOpen] = useState(false);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [sidebarDragResetKey, setSidebarDragResetKey] = useState(0);
  const [createTableRequest, setCreateTableRequest] = useState(0);
  const [appSettingsSection, setAppSettingsSection] = useState<"appearance" | "ai-service" | "version" | null>(null);
  const [aiCompleted, setAiCompleted] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const handleUndo = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !canUndo || event.shiftKey || !event.metaKey || event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      void undoStorageChange();
    };
    window.addEventListener("keydown", handleUndo);
    return () => window.removeEventListener("keydown", handleUndo);
  }, [canUndo, undoStorageChange]);

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
  const sidebarResizerVisible = sidebarOpen || sidebarResizing;
  const gridTemplateColumns = layout.mode === "narrow"
    ? `${layout.sidebarWidth}px minmax(0, 1fr)`
    : `${layout.sidebarWidth}px ${sidebarResizerVisible ? `${PANEL_RESIZER_WIDTH}px ` : ""}minmax(0, 1fr) ${layout.rightPanelMode === "dual" ? `${PANEL_RESIZER_WIDTH}px ${layout.detailWidth}px ${PANEL_RESIZER_WIDTH}px ${layout.aiWidth}px` : layout.rightPanelWidth ? `${PANEL_RESIZER_WIDTH}px ${layout.rightPanelWidth}px` : "0px"}`;
  const handleSidebarResize = (candidateWidth: number) => {
    if (sidebarOpen) {
      if (candidateWidth <= SIDEBAR_COLLAPSE_THRESHOLD) {
        setSidebarOpen(false);
        setSidebarDragResetKey((key) => key + 1);
      } else {
        setSidebarWidth(candidateWidth);
      }
      return;
    }
    if (candidateWidth >= SIDEBAR_EXPAND_THRESHOLD) {
      setSidebarOpen(true);
      setSidebarWidth(SIDEBAR_COMPACT_MIN_WIDTH);
      setSidebarDragResetKey((key) => key + 1);
    }
  };
  const handleSidebarDraggingChange = (dragging: boolean) => {
    setSidebarResizing(dragging);
  };
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
  const handleCreateTable = () => {
    if (layout.mode === "narrow") setNarrowSidebarOpen(true);
    else if (!sidebarOpen) toggleSidebar();
    setCreateTableRequest((request) => request + 1);
  };
  const handleCloseAi = () => {
    setAiOpen(false);
    void setProviderPanelOpen(false);
  };

  return (
    <div className="morfra-shell" data-testid="morfra-shell" data-window-mode={layout.mode} data-sidebar-open={sidebarOpen} data-right-panel-mode={layout.rightPanelMode} style={{ "--morfra-sidebar-width": `${layout.sidebarWidth}px`, "--morfra-right-panel-width": `${layout.rightPanelWidth}px` } as CSSProperties}>
      <StorageAICascade />
      <WindowTitlebar sidebarOpen={layout.mode === "narrow" ? narrowSidebarOpen : sidebarOpen} aiOpen={aiOpen} aiCompleted={aiCompleted} onToggleSidebar={handleToggleSidebar} onCreateTable={handleCreateTable} onToggleAi={handleToggleAi} />
      <div className="morfra-shell-body" style={{ gridTemplateColumns }}>
        <ProjectSidebar mode={layout.sidebarMode} createRequest={createTableRequest} />
        {layout.mode === "regular" && sidebarResizerVisible && <LayoutResizer className="morfra-sidebar-resizer" label="调整导航宽度" width={layout.sidebarWidth} direction="increase" onResize={handleSidebarResize} onKeyboardResize={setSidebarWidth} onDraggingChange={handleSidebarDraggingChange} dragResetKey={sidebarDragResetKey} valueMin={sidebarOpen ? SIDEBAR_COMPACT_MIN_WIDTH : layout.sidebarWidth} valueMax={360} />}
        <main className="morfra-main" aria-label="主显示区">{mainContent}</main>
        <RightPanelHost layout={layout} activePanel={activeRightPanel} detailOpen={detailOpen} aiOpen={aiOpen} detailContent={<StorageRecordDetailPanel />} aiContent={<StorageAIHost />} onCloseDetail={toggleDetail} onCloseAi={handleCloseAi} onSelectPanel={setActiveRightPanel} onResizeDetail={setDetailWidth} onResizeAi={setAiWidth} navigationOverlayOpen={narrowSidebarOpen} />
      </div>
      {layout.mode === "narrow" && narrowSidebarOpen && <div className="morfra-sidebar-overlay"><button type="button" className="morfra-sidebar-overlay-scrim" aria-label="关闭项目导航" onClick={() => setNarrowSidebarOpen(false)} /><div className="morfra-sidebar-overlay-panel"><ProjectSidebar createRequest={createTableRequest} onTableSelected={() => setNarrowSidebarOpen(false)} /></div></div>}
      {appSettingsSection && <div className="fixed inset-0 z-50 flex items-center justify-center p-6"><button type="button" aria-label="关闭应用设置" className="absolute inset-0 border-none bg-(--overlay-scrim)" onClick={() => setAppSettingsSection(null)} /><section role="dialog" aria-modal="true" aria-label="应用设置" className="relative flex h-[min(720px,calc(100vh-48px))] w-[min(960px,calc(100vw-48px))] overflow-hidden rounded-(--r-lg) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) shadow-(--shadow-panel)"><AppSettingsPage section={appSettingsSection} onSelectSection={setAppSettingsSection} onClose={() => setAppSettingsSection(null)} /></section></div>}
    </div>
  );
}

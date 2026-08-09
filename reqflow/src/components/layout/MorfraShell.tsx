import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { currentProject, useProjectStore } from "../../stores/projectStore";
import { calculateWindowLayout, PANEL_RESIZER_WIDTH, type WindowLayout } from "../../lib/layout/windowLayout";
import { useLayoutStore, type AppearanceMode } from "../../stores/layoutStore";
import { applyAccessibilityPreferences, applyAppearanceMode, subscribeToAccessibilityPreferences, subscribeToSystemAppearance } from "../../lib/layout/appearance";
import { WindowTitlebar } from "./WindowTitlebar";
import { RightPanelHost } from "./RightPanelHost";
import { LayoutResizer } from "./LayoutResizer";

interface MorfraShellProps {
  mainContent: ReactNode;
}

function ProjectSidebar({ onProjectSelected }: { onProjectSelected?: () => void }) {
  const projects = useProjectStore((state) => state.projects);
  const project = useProjectStore(currentProject);
  const switchProject = useProjectStore((state) => state.switchProject);
  const createProject = useProjectStore((state) => state.createProject);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    setError(null);
    try {
      await createProject(nextName);
      setName("");
    } catch {
      setError("项目创建失败，请重试");
    }
  }

  async function handleSwitch(id: string) {
    setError(null);
    try {
      await switchProject(id);
      onProjectSelected?.();
    } catch {
      setError("项目打开失败，请检查项目包完整性");
    }
  }

  return (
    <aside className="morfra-sidebar" data-testid="morfra-sidebar" aria-label="项目导航">
      <div className="morfra-sidebar-heading"><span>项目</span><span className="morfra-sidebar-count">{projects.length}</span></div>
      <div className="morfra-sidebar-projects">
        {projects.map((item) => <button type="button" key={item.id} className={`morfra-project-item ${item.id === project?.id ? "is-active" : ""}`} aria-current={item.id === project?.id ? "page" : undefined} onClick={() => void handleSwitch(item.id)}><span className="morfra-project-dot" /> <span className="morfra-project-name">{item.name}</span></button>)}
      </div>
      <div className="morfra-sidebar-section">
        <div className="morfra-sidebar-label">当前表</div>
        {project?.storageSnapshot?.tables[0] ? <div className="morfra-table-item is-active"><span className="morfra-table-icon">▦</span><span className="morfra-project-name">{project.storageSnapshot.tables[0].name}</span></div> : <div className="morfra-sidebar-empty">没有打开的表</div>}
        {project?.storageSnapshot?.tables[0]?.views[0] && <div className="morfra-view-item"><span className="morfra-view-icon">≡</span>{project.storageSnapshot.tables[0].views[0].name}</div>}
      </div>
      <form className="morfra-sidebar-create" onSubmit={(event) => void handleCreate(event)}>
        <input aria-label="新建 Morfra 项目名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="新建项目" />
        <button type="submit" aria-label="创建项目">＋</button>
      </form>
      {error && <p className="morfra-sidebar-error" role="alert">{error}</p>}
    </aside>
  );
}

function EmptyDetailPanel() {
  return <div className="morfra-context-empty"><span className="morfra-empty-symbol">○</span><p>选择一条记录查看详情</p><span>记录字段和活动会显示在这里</span></div>;
}

function AiHostPanel() {
  return <div className="morfra-context-empty morfra-ai-empty"><span className="morfra-empty-symbol">✦</span><p>AI 表格助手</p><span>AI 工作区宿主</span></div>;
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
      <WindowTitlebar projectName={project?.name ?? null} sidebarOpen={layout.mode === "narrow" ? narrowSidebarOpen : sidebarOpen} aiOpen={aiOpen} appearanceMode={appearanceMode} onToggleSidebar={handleToggleSidebar} onToggleAi={handleToggleAi} onCycleAppearance={() => setAppearanceMode(cycleAppearance(appearanceMode))} />
      <div className="morfra-shell-body" style={{ gridTemplateColumns }}>
        <ProjectSidebar />
        {layout.mode === "regular" && sidebarOpen && <LayoutResizer className="morfra-sidebar-resizer" label="调整导航宽度" width={layout.sidebarWidth} direction="increase" onResize={setSidebarWidth} />}
        <main className="morfra-main" aria-label="主显示区">{mainContent}</main>
        <RightPanelHost layout={layout} activePanel={activeRightPanel} detailOpen={detailOpen} aiOpen={aiOpen} detailContent={<EmptyDetailPanel />} aiContent={<AiHostPanel />} onCloseDetail={toggleDetail} onCloseAi={toggleAi} onSelectPanel={setActiveRightPanel} onResizeDetail={setDetailWidth} onResizeAi={setAiWidth} navigationOverlayOpen={narrowSidebarOpen} />
      </div>
      {layout.mode === "narrow" && narrowSidebarOpen && <div className="morfra-sidebar-overlay"><button type="button" className="morfra-sidebar-overlay-scrim" aria-label="关闭项目导航" onClick={() => setNarrowSidebarOpen(false)} /><div className="morfra-sidebar-overlay-panel"><ProjectSidebar onProjectSelected={() => setNarrowSidebarOpen(false)} /></div></div>}
    </div>
  );
}

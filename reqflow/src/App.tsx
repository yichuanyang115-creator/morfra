import { useEffect, useState } from "react";
import { Topbar } from "./components/topbar/Topbar";
import { MainLayout } from "./components/layout/MainLayout";
import { Board } from "./components/board/Board";
import { useProjectStore } from "./stores/projectStore";
import { useRequirementStore } from "./stores/requirementStore";

function App() {
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const initProjects = useProjectStore((s) => s.init);
  const projectsLoaded = useProjectStore((s) => s.loaded);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const requirements = useRequirementStore((s) => s.requirements);
  const requirementsLoading = useRequirementStore((s) => s.loading);
  const requirementsError = useRequirementStore((s) => s.error);
  const loadedProjectId = useRequirementStore((s) => s.loadedProjectId);
  const loadForProject = useRequirementStore((s) => s.loadForProject);
  const createRequirement = useRequirementStore((s) => s.createRequirement);
  const updateProgress = useRequirementStore((s) => s.updateProgress);

  useEffect(() => {
    void initProjects();
  }, [initProjects]);

  useEffect(() => {
    if (currentProjectId && currentProjectId !== loadedProjectId) {
      void loadForProject(currentProjectId);
    }
  }, [currentProjectId, loadedProjectId, loadForProject]);

  if (!projectsLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-(--muted) text-[13px]">
        加载中…
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      <Topbar detailCollapsed={detailCollapsed} onTogglePanel={() => setDetailCollapsed((v) => !v)} />
      <MainLayout
        detailMode={detailCollapsed ? "collapsed" : "expanded"}
        boardContent={
          <Board
            requirements={requirements}
            loading={requirementsLoading || currentProjectId !== loadedProjectId}
            error={requirementsError}
            onCreate={(stage, name) => {
              if (currentProjectId) void createRequirement(currentProjectId, stage, name);
            }}
            onProgressChange={(requirementId, progress) => {
              if (currentProjectId) void updateProgress(currentProjectId, requirementId, progress);
            }}
          />
        }
        detailContent={
          <div className="flex h-full items-center justify-center text-(--muted) text-[13px]">
            需求详情将在后续 Phase 实现
          </div>
        }
      />
    </div>
  );
}

export default App;

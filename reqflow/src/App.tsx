import { useCallback, useEffect, useState } from "react";
import { AppWorkspace } from "./components/layout/AppWorkspace";
import { useProjectStore, currentProject } from "./stores/projectStore";
import { useRequirementStore } from "./stores/requirementStore";
import { useChatStore } from "./stores/chatStore";
import { useUiStore } from "./stores/uiStore";
import { useSchemaStore } from "./stores/schemaStore";
import { useThemeStore } from "./stores/themeStore";
import { Toast } from "./components/shared/Toast";
import { UndoToast } from "./components/shared/UndoToast";
import { useUndoKeyboard } from "./hooks/useUndoKeyboard";

function mostRecentRequirementId<T extends { id: string; createdAt: string }>(requirements: T[]): string | null {
  if (requirements.length === 0) return null;
  return requirements.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].id;
}

function App() {
  const [undoSummary, setUndoSummary] = useState<string | null>(null);
  const showUndoToast = useCallback((summary: string) => setUndoSummary(summary), []);
  useUndoKeyboard(showUndoToast);
  const initProjects = useProjectStore((s) => s.init);
  const loadTheme = useThemeStore((s) => s.load);
  const themeLoaded = useThemeStore((s) => s.loaded);
  const themeRecoveryNotice = useThemeStore((s) => s.recoveryNotice);
  const acknowledgeThemeRecovery = useThemeStore((s) => s.acknowledgeRecovery);
  const projectsLoaded = useProjectStore((s) => s.loaded);
  const projectsError = useProjectStore((s) => s.error);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const project = useProjectStore(currentProject);

  const requirements = useRequirementStore((s) => s.requirements);
  const loadedProjectId = useRequirementStore((s) => s.loadedProjectId);
  const loadForProject = useRequirementStore((s) => s.loadForProject);
  const selectedRequirementId = useUiStore((s) => s.selectedRequirementId);
  const selectRequirement = useUiStore((s) => s.selectRequirement);
  const chatLoadedProjectId = useChatStore((s) => s.loadedProjectId);
  const loadChatForProject = useChatStore((s) => s.loadForProject);
  const schemaLoadedProjectId = useSchemaStore((s) => s.loadedProjectId);
  const loadSchemaForProject = useSchemaStore((s) => s.loadForProject);

  useEffect(() => {
    void loadTheme();
  }, [loadTheme]);

  useEffect(() => {
    void initProjects();
  }, [initProjects]);

  useEffect(() => {
    if (currentProjectId && currentProjectId !== loadedProjectId) {
      void loadForProject(currentProjectId);
    }
  }, [currentProjectId, loadedProjectId, loadForProject]);

  // REQ-029：打开项目时检测并静默补齐等价 Schema（无 schema.json 即旧项目），迁移发生后弹 toast。
  useEffect(() => {
    if (currentProjectId && currentProjectId !== schemaLoadedProjectId) {
      void loadSchemaForProject(currentProjectId, project?.sources ?? []);
    }
  }, [currentProjectId, schemaLoadedProjectId, loadSchemaForProject, project]);

  // REQ-024 v2.7：对话框状态和记录按项目落盘，切换项目时跟需求列表一样重新加载。
  useEffect(() => {
    if (currentProjectId && currentProjectId !== chatLoadedProjectId) {
      void loadChatForProject(currentProjectId);
    }
  }, [currentProjectId, chatLoadedProjectId, loadChatForProject]);

  // REQ-004 MUST：右栏默认显示最近操作的需求。项目切换后 selectedRequirementId
  // 会指向已不存在于当前需求列表里的旧需求，此时也要重新选中当前项目最近操作的需求。
  useEffect(() => {
    if (loadedProjectId !== currentProjectId) return;
    const stillExists = requirements.some((r) => r.id === selectedRequirementId);
    if (!stillExists) {
      const mostRecentId = mostRecentRequirementId(requirements);
      if (mostRecentId) selectRequirement(mostRecentId);
    }
  }, [loadedProjectId, currentProjectId, requirements, selectedRequirementId, selectRequirement]);

  if (!themeLoaded) {
    return <div className="flex h-screen w-screen items-center justify-center text-(--muted) text-[13px]">加载外观…</div>;
  }

  if (projectsError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-(--muted) text-[13px]">
        数据读取失败，请检查项目文件夹
      </div>
    );
  }

  if (!projectsLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-(--muted) text-[13px]">
        加载中…
      </div>
    );
  }

  return (
    <>
      <AppWorkspace />
      {themeRecoveryNotice && <Toast message={themeRecoveryNotice} onDismiss={acknowledgeThemeRecovery} />}
      {undoSummary && <UndoToast summary={undoSummary} onDismiss={() => setUndoSummary(null)} />}
    </>
  );
}

export default App;

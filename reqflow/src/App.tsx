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
import { isTauriRuntime } from "./lib/ipc/storageClient";
import { StorageWorkspace } from "./components/storage/StorageWorkspace";
import { MorfraShell } from "./components/layout/MorfraShell";

function mostRecentRequirementId<T extends { id: string; createdAt: string }>(requirements: T[]): string | null {
  if (requirements.length === 0) return null;
  return requirements.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].id;
}

function App() {
  const storageRuntime = isTauriRuntime();
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
    if (storageRuntime) return;
    if (currentProjectId && currentProjectId !== loadedProjectId) {
      void loadForProject(currentProjectId);
    }
  }, [currentProjectId, loadedProjectId, loadForProject, storageRuntime]);

  // REQ-029：打开项目时检测并静默补齐等价 Schema（无 schema.json 即旧项目），迁移发生后弹 toast。
  useEffect(() => {
    if (storageRuntime) return;
    if (currentProjectId && currentProjectId !== schemaLoadedProjectId) {
      void loadSchemaForProject(currentProjectId, project?.sources ?? []);
    }
  }, [currentProjectId, schemaLoadedProjectId, loadSchemaForProject, project, storageRuntime]);

  // REQ-024 v2.7：对话框状态和记录按项目落盘，切换项目时跟需求列表一样重新加载。
  useEffect(() => {
    if (storageRuntime) return;
    if (currentProjectId && currentProjectId !== chatLoadedProjectId) {
      void loadChatForProject(currentProjectId);
    }
  }, [currentProjectId, chatLoadedProjectId, loadChatForProject, storageRuntime]);

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

  if (!themeLoaded || projectsError || !projectsLoaded || storageRuntime) {
    const storageMainContent = !themeLoaded ? (
      <div className="flex h-full items-center justify-center text-(--module-scope-text-secondary) text-[13px]">加载外观…</div>
    ) : projectsError ? (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-(--module-scope-text-secondary) text-[13px]">
        <span>项目数据读取失败，请检查应用数据目录</span>
        <button type="button" onClick={() => void initProjects()} className="rounded border border-(--module-scope-border-subtle) px-2.5 py-1.5 text-[12px]">重试</button>
      </div>
    ) : !projectsLoaded ? (
      <div className="flex h-full items-center justify-center text-(--module-scope-text-secondary) text-[13px]">加载项目…</div>
    ) : <StorageWorkspace embedded />;

    return <MorfraShell mainContent={storageMainContent} />;
  }

  return (
    <>
      <AppWorkspace />
      {themeRecoveryNotice && <Toast message={themeRecoveryNotice} tone="danger" onDismiss={acknowledgeThemeRecovery} />}
      {undoSummary && <UndoToast summary={undoSummary} onDismiss={() => setUndoSummary(null)} />}
    </>
  );
}

export default App;

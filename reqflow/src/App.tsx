import { useEffect } from "react";
import { Topbar } from "./components/topbar/Topbar";
import { MainLayout } from "./components/layout/MainLayout";
import { Board } from "./components/board/Board";
import { DetailPanel } from "./components/detail/DetailPanel";
import { useProjectStore, currentProject } from "./stores/projectStore";
import { useRequirementStore } from "./stores/requirementStore";
import { useChatStore } from "./stores/chatStore";
import { useUiStore } from "./stores/uiStore";
import { useSchemaStore } from "./stores/schemaStore";
import { detailAttributesFor } from "./lib/schemaSelectors";
import { Toast } from "./components/shared/Toast";

function mostRecentRequirementId<T extends { id: string; createdAt: string }>(requirements: T[]): string | null {
  if (requirements.length === 0) return null;
  return requirements.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].id;
}

function App() {
  const initProjects = useProjectStore((s) => s.init);
  const projectsLoaded = useProjectStore((s) => s.loaded);
  const projectsError = useProjectStore((s) => s.error);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const project = useProjectStore(currentProject);

  const requirements = useRequirementStore((s) => s.requirements);
  const requirementsLoading = useRequirementStore((s) => s.loading);
  const requirementsError = useRequirementStore((s) => s.error);
  const loadedProjectId = useRequirementStore((s) => s.loadedProjectId);
  const loadForProject = useRequirementStore((s) => s.loadForProject);
  const createRequirement = useRequirementStore((s) => s.createRequirement);
  const renameRequirement = useRequirementStore((s) => s.renameRequirement);
  const updateAttributeValue = useRequirementStore((s) => s.updateAttributeValue);
  const updateBody = useRequirementStore((s) => s.updateBody);
  const addDeliverable = useRequirementStore((s) => s.addDeliverable);
  const updateDeliverable = useRequirementStore((s) => s.updateDeliverable);
  const removeDeliverable = useRequirementStore((s) => s.removeDeliverable);
  const addTask = useRequirementStore((s) => s.addTask);
  const updateTask = useRequirementStore((s) => s.updateTask);
  const removeTask = useRequirementStore((s) => s.removeTask);
  const addAcceptance = useRequirementStore((s) => s.addAcceptance);
  const updateAcceptance = useRequirementStore((s) => s.updateAcceptance);
  const removeAcceptance = useRequirementStore((s) => s.removeAcceptance);
  const transitionRequirement = useRequirementStore((s) => s.transitionRequirement);
  const updateTransitionNote = useRequirementStore((s) => s.updateTransitionNote);
  const addComment = useRequirementStore((s) => s.addComment);
  const removeTransition = useRequirementStore((s) => s.removeTransition);
  const reorderManually = useRequirementStore((s) => s.reorderManually);

  const selectedRequirementId = useUiStore((s) => s.selectedRequirementId);
  const detailMode = useUiStore((s) => s.detailMode);
  const activeTab = useUiStore((s) => s.activeTab);
  const selectRequirement = useUiStore((s) => s.selectRequirement);
  const toggleFullscreen = useUiStore((s) => s.toggleFullscreen);
  const toggleClosed = useUiStore((s) => s.toggleClosed);
  const setActiveTab = useUiStore((s) => s.setActiveTab);

  const chatLoadedProjectId = useChatStore((s) => s.loadedProjectId);
  const loadChatForProject = useChatStore((s) => s.loadForProject);

  const schema = useSchemaStore((s) => s.schema);
  const schemaLoadedProjectId = useSchemaStore((s) => s.loadedProjectId);
  const loadSchemaForProject = useSchemaStore((s) => s.loadForProject);
  const justMigrated = useSchemaStore((s) => s.justMigrated);
  const acknowledgeMigration = useSchemaStore((s) => s.acknowledgeMigration);

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

  const selectedRequirement = requirements.find((r) => r.id === selectedRequirementId) ?? null;
  const detailAttributes = detailAttributesFor(schema);
  const selectedStageOption = selectedRequirement
    ? schema?.stageOptions.find((s) => s.id === selectedRequirement.stage)
    : undefined;

  return (
    <div className="flex h-screen w-screen flex-col">
      <Topbar />
      <MainLayout
        detailMode={detailMode}
        boardContent={
          <Board
            requirements={requirements}
            loading={requirementsLoading || currentProjectId !== loadedProjectId}
            error={requirementsError}
            selectedRequirementId={selectedRequirementId}
            onCreate={(stage, name) => {
              if (currentProjectId) void createRequirement(currentProjectId, stage, name);
            }}
            onSelectRequirement={selectRequirement}
            onAttributeChange={(requirementId, attributeId, value) => {
              if (currentProjectId) void updateAttributeValue(currentProjectId, requirementId, attributeId, value);
            }}
            onTransition={(requirementId, toStage) => {
              if (currentProjectId) void transitionRequirement(currentProjectId, requirementId, toStage);
            }}
            onReorder={(updates) => {
              if (currentProjectId) void reorderManually(currentProjectId, updates);
            }}
          />
        }
        detailContent={(width) => (
          <DetailPanel
            requirement={selectedRequirement}
            attributes={detailAttributes}
            isTerminal={selectedStageOption?.isTerminal ?? false}
            width={width}
            fullscreen={detailMode === "fullscreen"}
            activeTab={activeTab}
            onToggleFullscreen={toggleFullscreen}
            onClose={toggleClosed}
            onSelectTab={setActiveTab}
            onRename={(name) => {
              if (currentProjectId && selectedRequirementId) {
                void renameRequirement(currentProjectId, selectedRequirementId, name);
              }
            }}
            onAttributeChange={(attributeId, value) => {
              if (currentProjectId && selectedRequirementId) {
                void updateAttributeValue(currentProjectId, selectedRequirementId, attributeId, value);
              }
            }}
            onBodyChange={(body) => {
              if (currentProjectId && selectedRequirementId) {
                void updateBody(currentProjectId, selectedRequirementId, body);
              }
            }}
            onCreateDeliverable={(name) => {
              if (currentProjectId && selectedRequirementId) {
                void addDeliverable(currentProjectId, selectedRequirementId, name);
              }
            }}
            onUpdateDeliverable={(deliverableId, patch) => {
              if (currentProjectId && selectedRequirementId) {
                void updateDeliverable(currentProjectId, selectedRequirementId, deliverableId, patch);
              }
            }}
            onRemoveDeliverable={(deliverableId) => {
              if (currentProjectId && selectedRequirementId) {
                void removeDeliverable(currentProjectId, selectedRequirementId, deliverableId);
              }
            }}
            onCreateTask={(task) => {
              if (currentProjectId && selectedRequirementId) {
                void addTask(currentProjectId, selectedRequirementId, task);
              }
            }}
            onUpdateTask={(taskId, patch) => {
              if (currentProjectId && selectedRequirementId) {
                void updateTask(currentProjectId, selectedRequirementId, taskId, patch);
              }
            }}
            onRemoveTask={(taskId) => {
              if (currentProjectId && selectedRequirementId) {
                void removeTask(currentProjectId, selectedRequirementId, taskId);
              }
            }}
            onCreateAcceptance={(desc) => {
              if (currentProjectId && selectedRequirementId) {
                void addAcceptance(currentProjectId, selectedRequirementId, desc);
              }
            }}
            onUpdateAcceptance={(acceptanceId, patch) => {
              if (currentProjectId && selectedRequirementId) {
                void updateAcceptance(currentProjectId, selectedRequirementId, acceptanceId, patch);
              }
            }}
            onRemoveAcceptance={(acceptanceId) => {
              if (currentProjectId && selectedRequirementId) {
                void removeAcceptance(currentProjectId, selectedRequirementId, acceptanceId);
              }
            }}
            onTransition={(toStage, opts) => {
              if (currentProjectId && selectedRequirementId) {
                void transitionRequirement(currentProjectId, selectedRequirementId, toStage, opts);
              }
            }}
            onUpdateTransitionNote={(transitionId, note) => {
              if (currentProjectId && selectedRequirementId) {
                void updateTransitionNote(currentProjectId, selectedRequirementId, transitionId, note);
              }
            }}
            onAddComment={(transitionId, content) => {
              if (currentProjectId && selectedRequirementId) {
                void addComment(currentProjectId, selectedRequirementId, transitionId, content);
              }
            }}
            onDeleteTransition={(transitionId) => {
              if (currentProjectId && selectedRequirementId) {
                void removeTransition(currentProjectId, selectedRequirementId, transitionId);
              }
            }}
          />
        )}
      />
      {justMigrated && <Toast message="项目已自动升级为动态 Schema" onDismiss={acknowledgeMigration} />}
    </div>
  );
}

export default App;

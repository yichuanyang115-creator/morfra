import { Board } from "../board/Board";
import { DetailPanel } from "../detail/DetailPanel";
import { AppSettingsPage } from "../app-settings/AppSettingsPage";
import { MainLayout } from "./MainLayout";
import { SchemaSettingsWorkspace } from "../settings/SchemaSettingsWorkspace";
import { Topbar } from "../topbar/Topbar";
import { Toast } from "../shared/Toast";
import { useRequirementStore } from "../../stores/requirementStore";
import { useUiStore } from "../../stores/uiStore";
import { useSchemaStore } from "../../stores/schemaStore";
import { useProjectStore } from "../../stores/projectStore";
import { detailAttributesFor } from "../../lib/schemaSelectors";

export function AppWorkspace() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const requirements = useRequirementStore((s) => s.requirements);
  const requirementsLoading = useRequirementStore((s) => s.loading);
  const requirementsError = useRequirementStore((s) => s.error);
  const loadedProjectId = useRequirementStore((s) => s.loadedProjectId);
  const createRequirement = useRequirementStore((s) => s.createRequirement);
  const deleteRequirement = useRequirementStore((s) => s.deleteRequirement);
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

  const schema = useSchemaStore((s) => s.schema);
  const justMigrated = useSchemaStore((s) => s.justMigrated);
  const acknowledgeMigration = useSchemaStore((s) => s.acknowledgeMigration);
  const settingsOpen = useUiStore((s) => s.settingsSection !== null);
  const appSettingsSection = useUiStore((s) => s.appSettingsSection);
  const setAppSettingsSection = useUiStore((s) => s.setAppSettingsSection);
  const closeAppSettings = useUiStore((s) => s.closeAppSettings);
  const openSettings = useUiStore((s) => s.openSettings);
  const updateAttribute = useSchemaStore((s) => s.updateAttribute);
  const setColumnWidth = useSchemaStore((s) => s.setColumnWidth);
  const setColumnOrder = useSchemaStore((s) => s.setColumnOrder);
  const setFrozenCount = useSchemaStore((s) => s.setFrozenCount);
  const setStageSortManual = useSchemaStore((s) => s.setStageSortManual);
  const setStageSort = useSchemaStore((s) => s.setStageSort);
  const clearStageSort = useSchemaStore((s) => s.clearStageSort);

  const selectedRequirement = requirements.find((r) => r.id === selectedRequirementId) ?? null;
  const detailAttributes = detailAttributesFor(schema);
  const selectedStageOption = selectedRequirement
    ? schema?.stageOptions.find((s) => s.id === selectedRequirement.stage)
    : undefined;

  return (
    <div className="flex h-screen w-screen flex-col">
      <Topbar />
      {appSettingsSection ? (
        <AppSettingsPage section={appSettingsSection} onSelectSection={setAppSettingsSection} onClose={closeAppSettings} />
      ) : settingsOpen && schema ? (
        <SchemaSettingsWorkspace />
      ) : (
        <MainLayout
          detailMode={detailMode}
          boardContent={
            <Board
              projectId={currentProjectId}
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
              onDelete={(requirementId) => {
                if (!currentProjectId) return;
                void (async () => {
                  await deleteRequirement(currentProjectId, requirementId);
                  if (selectedRequirementId === requirementId && detailMode !== "closed") toggleClosed();
                })();
              }}
              onTransition={(requirementId, toStage) => {
                if (currentProjectId) void transitionRequirement(currentProjectId, requirementId, toStage);
              }}
              onReorder={async (updates, stageId) => {
                if (!currentProjectId) return;
                const previousStageSort = schema?.viewPreferences.stageSorts?.[stageId] ?? null;
                await setStageSortManual(currentProjectId, stageId);
                await reorderManually(currentProjectId, updates, async () => {
                  if (previousStageSort === null) await clearStageSort(currentProjectId, stageId);
                  else if ("mode" in previousStageSort) await setStageSortManual(currentProjectId, stageId);
                  else await setStageSort(currentProjectId, stageId, previousStageSort);
                });
              }}
              onEditAttribute={(attributeId) => openSettings({ kind: "attributes", attributeId })}
              onHideAttribute={(attributeId) => {
                if (currentProjectId) void updateAttribute(currentProjectId, attributeId, { showOnBoard: false });
              }}
              onFreezeTo={(count) => {
                if (currentProjectId) void setFrozenCount(currentProjectId, count);
              }}
              onColumnWidthCommit={(attributeId, width) => {
                if (!currentProjectId) return Promise.resolve();
                return setColumnWidth(currentProjectId, attributeId, width);
              }}
              onColumnOrderCommit={(orderedIds) => {
                if (currentProjectId) void setColumnOrder(currentProjectId, orderedIds);
              }}
            />
          }
          detailContent={(width) => (
            <DetailPanel
              requirement={selectedRequirement}
              attributes={detailAttributes}
              tabs={schema?.tabs ?? []}
              stageOptions={schema?.stageOptions ?? []}
              projectId={currentProjectId}
              isTerminal={selectedStageOption?.isTerminal ?? false}
              width={width}
              fullscreen={detailMode === "fullscreen"}
              activeTab={activeTab}
              onToggleFullscreen={toggleFullscreen}
              onClose={toggleClosed}
              onDelete={() => {
                if (!currentProjectId || !selectedRequirementId) return;
                void (async () => {
                  await deleteRequirement(currentProjectId, selectedRequirementId);
                  if (detailMode !== "closed") toggleClosed();
                })();
              }}
              onSelectTab={setActiveTab}
              onRename={(name) => {
                if (currentProjectId && selectedRequirementId) void renameRequirement(currentProjectId, selectedRequirementId, name);
              }}
              onAttributeChange={(attributeId, value) => {
                if (currentProjectId && selectedRequirementId) void updateAttributeValue(currentProjectId, selectedRequirementId, attributeId, value);
              }}
              onBodyChange={(body) => {
                if (currentProjectId && selectedRequirementId) void updateBody(currentProjectId, selectedRequirementId, body);
              }}
              onCreateDeliverable={(name) => {
                if (currentProjectId && selectedRequirementId) void addDeliverable(currentProjectId, selectedRequirementId, name);
              }}
              onUpdateDeliverable={(deliverableId, patch) => {
                if (currentProjectId && selectedRequirementId) void updateDeliverable(currentProjectId, selectedRequirementId, deliverableId, patch);
              }}
              onRemoveDeliverable={(deliverableId) => {
                if (currentProjectId && selectedRequirementId) void removeDeliverable(currentProjectId, selectedRequirementId, deliverableId);
              }}
              onCreateTask={(task) => {
                if (currentProjectId && selectedRequirementId) void addTask(currentProjectId, selectedRequirementId, task);
              }}
              onUpdateTask={(taskId, patch) => {
                if (currentProjectId && selectedRequirementId) void updateTask(currentProjectId, selectedRequirementId, taskId, patch);
              }}
              onRemoveTask={(taskId) => {
                if (currentProjectId && selectedRequirementId) void removeTask(currentProjectId, selectedRequirementId, taskId);
              }}
              onCreateAcceptance={(desc) => {
                if (currentProjectId && selectedRequirementId) void addAcceptance(currentProjectId, selectedRequirementId, desc);
              }}
              onUpdateAcceptance={(acceptanceId, patch) => {
                if (currentProjectId && selectedRequirementId) void updateAcceptance(currentProjectId, selectedRequirementId, acceptanceId, patch);
              }}
              onRemoveAcceptance={(acceptanceId) => {
                if (currentProjectId && selectedRequirementId) void removeAcceptance(currentProjectId, selectedRequirementId, acceptanceId);
              }}
              onTransition={(toStage, opts) => {
                if (currentProjectId && selectedRequirementId) void transitionRequirement(currentProjectId, selectedRequirementId, toStage, opts);
              }}
              onUpdateTransitionNote={(transitionId, note) => {
                if (currentProjectId && selectedRequirementId) void updateTransitionNote(currentProjectId, selectedRequirementId, transitionId, note);
              }}
              onAddComment={(transitionId, content) => {
                if (currentProjectId && selectedRequirementId) void addComment(currentProjectId, selectedRequirementId, transitionId, content);
              }}
              onDeleteTransition={(transitionId) => {
                if (currentProjectId && selectedRequirementId) void removeTransition(currentProjectId, selectedRequirementId, transitionId);
              }}
            />
          )}
        />
      )}
      {justMigrated && <Toast message="项目已自动升级为动态 Schema" tone="success" onDismiss={acknowledgeMigration} />}
    </div>
  );
}

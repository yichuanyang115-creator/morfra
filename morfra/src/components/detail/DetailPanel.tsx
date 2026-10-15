import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Deliverable, Requirement, Stage, Task } from "../../types/models";
import type { Attribute, TabDefinition } from "../../types/schema";
import type { DetailTab } from "../../stores/uiStore";
import { DETAIL_MIN_WIDTH } from "../../lib/boardWidth";
import { DetailHeader } from "./DetailHeader";
import { AttributeGrid } from "./AttributeGrid";
import { TabBar } from "./TabBar";
import { BodyTab } from "./tabs/BodyTab";
import { DeliverablesTab } from "./tabs/DeliverablesTab";
import { TasksTab } from "./tabs/TasksTab";
import { AcceptanceTab } from "./tabs/AcceptanceTab";
import type { AcceptancePatch } from "./tabs/acceptanceShared";
import { ActivityTab } from "./tabs/ActivityTab";
import { TemplateDrawer } from "../editor/TemplateDrawer";
import { resultOf } from "../../lib/requirementFields";
import { GenericTab } from "./tabs/GenericTab";

function PlusIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface DetailPanelProps {
  requirement: Requirement | null;
  /** 已按 schema showOnDetail 过滤好的属性列表，见 lib/schemaSelectors.ts 的 detailAttributesFor。 */
  attributes: Attribute[];
  tabs?: TabDefinition[];
  stageOptions?: import("../../types/schema").StageOption[];
  projectId?: string | null;
  /** 该实体所属阶段是否终态（见 Attribute Grid 的 result 只读规则，REQ-022）。 */
  isTerminal: boolean;
  /** 详情面板当前实际渲染宽度，由 MainLayout 用 detailPanelWidthFor 算出后传入——
   * 单一来源，不在这里用 ResizeObserver 反推（DOM 测量链路太长，任何一层布局细节
   * 偏差都会导致算出的宽度和真实值不一致，且难以定位）。 */
  width: number;
  fullscreen: boolean;
  activeTab: DetailTab;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onDelete?: () => void;
  onSelectTab: (tab: DetailTab) => void;
  onRename: (name: string) => void;
  onAttributeChange: (attributeId: string, value: unknown) => void;
  onBodyChange: (markdown: string) => void;
  onCreateDeliverable: (name: string) => void;
  onUpdateDeliverable: (
    deliverableId: string,
    patch: Partial<Pick<Deliverable, "name" | "checked" | "attach">>,
  ) => void;
  onRemoveDeliverable: (deliverableId: string) => void;
  onCreateTask: (task: Pick<Task, "name" | "assignee" | "deadline" | "progress">) => void;
  onUpdateTask: (
    taskId: string,
    patch: Partial<Pick<Task, "name" | "assignee" | "deadline" | "progress" | "status" | "blocked" | "blockNote">>,
  ) => void;
  onRemoveTask: (taskId: string) => void;
  onCreateAcceptance: (desc: string) => void;
  onUpdateAcceptance: (acceptanceId: string, patch: AcceptancePatch) => void;
  onRemoveAcceptance: (acceptanceId: string) => void;
  onTransition: (toStage: Stage, opts?: { abandoned?: boolean }) => void;
  onUpdateTransitionNote: (transitionId: string, note: string) => void;
  onAddComment: (transitionId: string, content: string) => void;
  onDeleteTransition: (transitionId: string) => void;
}

export function DetailPanel({
  requirement,
  attributes,
  tabs,
  stageOptions = [],
  projectId = null,
  isTerminal,
  width,
  fullscreen,
  activeTab,
  onToggleFullscreen,
  onClose,
  onDelete = () => undefined,
  onSelectTab,
  onRename,
  onAttributeChange,
  onBodyChange,
  onCreateDeliverable,
  onUpdateDeliverable,
  onRemoveDeliverable,
  onCreateTask,
  onUpdateTask,
  onRemoveTask,
  onCreateAcceptance,
  onUpdateAcceptance,
  onRemoveAcceptance,
  onTransition,
  onUpdateTransitionNote,
  onAddComment,
  onDeleteTransition,
}: DetailPanelProps) {
  const editorRef = useRef<Editor | null>(null);
  const [produceDraftOpen, setProduceDraftOpen] = useState(false);
  const [taskDraftOpen, setTaskDraftOpen] = useState(false);
  const [acceptanceDraftOpen, setAcceptanceDraftOpen] = useState(false);
  const [genericDraftTabId, setGenericDraftTabId] = useState<string | null>(null);
  // 属性区两列→单列的切换阈值（REQ-003 v2.8）：width 是 MainLayout 算出的详情面板
  // 确切宽度，跟 960px 可读性上限（由 MainLayout 外层容器的 max-width 负责）互不
  // 影响——480 远小于 960，两条阈值不会互相干扰。
  const compact = width <= DETAIL_MIN_WIDTH;
  const effectiveTabs = tabs ?? [
    { id: "body", name: "正文", renderer: "body" as const, visible: true },
    { id: "produce", name: "产出", renderer: "deliverables" as const, visible: true },
    { id: "tasks", name: "任务", renderer: "tasks" as const, visible: true },
    { id: "acceptance", name: "验收", renderer: "acceptance" as const, visible: true },
    { id: "activity", name: "活动", renderer: "activity" as const, visible: true },
  ];
  const activeDefinition = effectiveTabs.find((tab) => tab.id === activeTab) ?? effectiveTabs.find((tab) => tab.visible);
  const activeRenderer = activeDefinition?.renderer;
  const effectiveActiveTab = activeDefinition?.id ?? activeTab;

  if (!requirement) {
    return (
      <div data-theme-module="detail" className="theme-module-detail flex h-full flex-col items-center justify-center gap-2 p-5 text-center text-(--module-scope-text-tertiary)">
        <svg className="size-7.5" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <p className="m-0 text-[13px]">选择一条实体查看详情</p>
      </div>
    );
  }

  return (
    <div key={requirement.id} data-theme-module="detail" className="theme-module-detail flex h-full min-w-0 flex-col bg-(--module-scope-background-surface)">
      <DetailHeader
        requirement={requirement}
        fullscreen={fullscreen}
        onRename={onRename}
        onToggleFullscreen={onToggleFullscreen}
        onClose={onClose}
        onDelete={onDelete}
      />
      <AttributeGrid
        requirement={requirement}
        attributes={attributes}
        isTerminal={isTerminal}
        compact={compact}
        onAttributeChange={onAttributeChange}
        onTransition={onTransition}
      />
      <TabBar
        tabs={effectiveTabs}
        activeTab={effectiveActiveTab}
        onSelectTab={onSelectTab}
        slot={
          activeRenderer === "body" ? (
            <TemplateDrawer
              onInsert={(templateMarkdown) => {
                editorRef.current?.chain().focus().insertContent(templateMarkdown, { contentType: "markdown" }).run();
              }}
            />
          ) : activeRenderer === "deliverables" ? (
            <button
              type="button"
              title="新建产出"
              aria-label="新建产出"
              onClick={() => setProduceDraftOpen(true)}
              className="grid size-6.5 place-items-center rounded-full border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) text-(--module-scope-text-tertiary) hover:border-(--module-scope-action-base) hover:text-(--module-scope-action-strong)"
            >
              <PlusIcon />
            </button>
          ) : activeRenderer === "tasks" ? (
            <button
              type="button"
              title="新建任务"
              aria-label="新建任务"
              onClick={() => setTaskDraftOpen(true)}
              className="grid size-6.5 place-items-center rounded-full border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) text-(--module-scope-text-tertiary) hover:border-(--module-scope-action-base) hover:text-(--module-scope-action-strong)"
            >
              <PlusIcon />
            </button>
          ) : activeRenderer === "acceptance" ? (
            <button
              type="button"
              title="新建验收标准"
              aria-label="新建验收标准"
              onClick={() => setAcceptanceDraftOpen(true)}
              className="grid size-6.5 place-items-center rounded-full border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) text-(--module-scope-text-tertiary) hover:border-(--module-scope-action-base) hover:text-(--module-scope-action-strong)"
            >
              <PlusIcon />
            </button>
          ) : activeRenderer === "generic" && activeDefinition ? (
            <button
              type="button"
              title={`新建${activeDefinition.name}记录`}
              aria-label={`新建${activeDefinition.name}记录`}
              onClick={() => setGenericDraftTabId(activeDefinition.id)}
              className="grid size-6.5 place-items-center rounded-full border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) text-(--module-scope-text-tertiary) hover:border-(--module-scope-action-base) hover:text-(--module-scope-action-strong)"
            >
              <PlusIcon />
            </button>
          ) : undefined
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeRenderer === "body" ? (
          <BodyTab
            markdown={requirement.body}
            onChange={onBodyChange}
            onEditorReady={(editor) => {
              editorRef.current = editor;
            }}
          />
        ) : activeRenderer === "deliverables" ? (
          <DeliverablesTab
            deliverables={requirement.deliverables}
            draftOpen={produceDraftOpen}
            onCreate={(name) => {
              onCreateDeliverable(name);
              setProduceDraftOpen(false);
            }}
            onCancelDraft={() => setProduceDraftOpen(false)}
            onUpdate={onUpdateDeliverable}
            onRemove={onRemoveDeliverable}
          />
        ) : activeRenderer === "tasks" ? (
          <TasksTab
            tasks={requirement.tasks}
            draftOpen={taskDraftOpen}
            onCreate={(task) => {
              onCreateTask(task);
              setTaskDraftOpen(false);
            }}
            onCancelDraft={() => setTaskDraftOpen(false)}
            onUpdate={onUpdateTask}
            onRemove={onRemoveTask}
          />
        ) : activeRenderer === "acceptance" ? (
          <AcceptanceTab
            acceptance={requirement.acceptance}
            draftOpen={acceptanceDraftOpen}
            onCreate={(desc) => {
              onCreateAcceptance(desc);
              setAcceptanceDraftOpen(false);
            }}
            onCancelDraft={() => setAcceptanceDraftOpen(false)}
            onUpdate={onUpdateAcceptance}
            onRemove={onRemoveAcceptance}
          />
        ) : activeRenderer === "activity" ? (
          <ActivityTab
            currentStage={requirement.stage}
            transitions={requirement.transitions}
            comments={requirement.comments}
            stageLabels={Object.fromEntries(stageOptions.map((stage) => [stage.id, stage.label]))}
            closureType={resultOf(requirement)}
            onUpdateNote={onUpdateTransitionNote}
            onAddComment={onAddComment}
            onDelete={onDeleteTransition}
          />
        ) : activeDefinition ? (
          <GenericTab
            key={activeDefinition.id}
            projectId={projectId}
            requirementId={requirement.id}
            tab={activeDefinition}
            draftOpen={genericDraftTabId === activeDefinition.id}
            onCloseDraft={() => setGenericDraftTabId(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

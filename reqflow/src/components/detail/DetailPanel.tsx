import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Deliverable, Requirement, Stage, Task } from "../../types/models";
import type { Attribute } from "../../types/schema";
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
  isTerminal,
  width,
  fullscreen,
  activeTab,
  onToggleFullscreen,
  onClose,
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
  // 属性区两列→单列的切换阈值（REQ-003 v2.8）：width 是 MainLayout 算出的详情面板
  // 确切宽度，跟 960px 可读性上限（由 MainLayout 外层容器的 max-width 负责）互不
  // 影响——480 远小于 960，两条阈值不会互相干扰。
  const compact = width <= DETAIL_MIN_WIDTH;

  if (!requirement) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center text-(--muted-2)">
        <svg className="size-7.5" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <p className="m-0 text-[13px]">选择一条需求查看详情</p>
      </div>
    );
  }

  return (
    <div key={requirement.id} className="flex h-full min-w-0 flex-col">
      <DetailHeader
        requirement={requirement}
        fullscreen={fullscreen}
        onRename={onRename}
        onToggleFullscreen={onToggleFullscreen}
        onClose={onClose}
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
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        slot={
          activeTab === "body" ? (
            <TemplateDrawer
              onInsert={(templateMarkdown) => {
                editorRef.current?.chain().focus().insertContent(templateMarkdown, { contentType: "markdown" }).run();
              }}
            />
          ) : activeTab === "produce" ? (
            <button
              type="button"
              title="新建产出"
              aria-label="新建产出"
              onClick={() => setProduceDraftOpen(true)}
              className="grid size-6.5 place-items-center rounded-full border border-(--border-strong) bg-(--surface) text-(--muted-2) hover:border-(--accent) hover:text-(--accent-text)"
            >
              <PlusIcon />
            </button>
          ) : activeTab === "tasks" ? (
            <button
              type="button"
              title="新建任务"
              aria-label="新建任务"
              onClick={() => setTaskDraftOpen(true)}
              className="grid size-6.5 place-items-center rounded-full border border-(--border-strong) bg-(--surface) text-(--muted-2) hover:border-(--accent) hover:text-(--accent-text)"
            >
              <PlusIcon />
            </button>
          ) : activeTab === "acceptance" ? (
            <button
              type="button"
              title="新建验收标准"
              aria-label="新建验收标准"
              onClick={() => setAcceptanceDraftOpen(true)}
              className="grid size-6.5 place-items-center rounded-full border border-(--border-strong) bg-(--surface) text-(--muted-2) hover:border-(--accent) hover:text-(--accent-text)"
            >
              <PlusIcon />
            </button>
          ) : undefined
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === "body" ? (
          <BodyTab
            markdown={requirement.body}
            onChange={onBodyChange}
            onEditorReady={(editor) => {
              editorRef.current = editor;
            }}
          />
        ) : activeTab === "produce" ? (
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
        ) : activeTab === "tasks" ? (
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
        ) : activeTab === "acceptance" ? (
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
        ) : (
          <ActivityTab
            currentStage={requirement.stage}
            transitions={requirement.transitions}
            comments={requirement.comments}
            closureType={resultOf(requirement)}
            onUpdateNote={onUpdateTransitionNote}
            onAddComment={onAddComment}
            onDelete={onDeleteTransition}
          />
        )}
      </div>
    </div>
  );
}

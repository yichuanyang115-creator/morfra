import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Deliverable, Requirement } from "../../types/models";
import type { DetailTab } from "../../stores/uiStore";
import { DetailHeader } from "./DetailHeader";
import { AttributeGrid } from "./AttributeGrid";
import { TabBar } from "./TabBar";
import { BodyTab } from "./tabs/BodyTab";
import { DeliverablesTab } from "./tabs/DeliverablesTab";
import { TemplateDrawer } from "../editor/TemplateDrawer";

function PlusIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface DetailPanelProps {
  requirement: Requirement | null;
  sources: string[];
  fullscreen: boolean;
  activeTab: DetailTab;
  onToggleFullscreen: () => void;
  onSelectTab: (tab: DetailTab) => void;
  onRename: (name: string) => void;
  onFieldChange: <K extends "priority" | "assignee" | "source" | "deadline">(
    field: K,
    value: Requirement[K],
  ) => void;
  onProgressChange: (progress: number | null) => void;
  onAddSource: (source: string) => void;
  onBodyChange: (markdown: string) => void;
  onCreateDeliverable: (name: string) => void;
  onUpdateDeliverable: (
    deliverableId: string,
    patch: Partial<Pick<Deliverable, "name" | "checked" | "attach">>,
  ) => void;
  onRemoveDeliverable: (deliverableId: string) => void;
}

const TAB_PLACEHOLDER: Record<Exclude<DetailTab, "body" | "produce">, string> = {
  tasks: "任务将在后续 Phase 实现",
  acceptance: "验收将在后续 Phase 实现",
  activity: "活动将在后续 Phase 实现",
};

export function DetailPanel({
  requirement,
  sources,
  fullscreen,
  activeTab,
  onToggleFullscreen,
  onSelectTab,
  onRename,
  onFieldChange,
  onProgressChange,
  onAddSource,
  onBodyChange,
  onCreateDeliverable,
  onUpdateDeliverable,
  onRemoveDeliverable,
}: DetailPanelProps) {
  const editorRef = useRef<Editor | null>(null);
  const [produceDraftOpen, setProduceDraftOpen] = useState(false);

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
    <div key={requirement.id} className="flex h-full flex-col">
      <DetailHeader
        requirement={requirement}
        fullscreen={fullscreen}
        onRename={onRename}
        onToggleFullscreen={onToggleFullscreen}
      />
      <AttributeGrid
        requirement={requirement}
        sources={sources}
        onFieldChange={onFieldChange}
        onProgressChange={onProgressChange}
        onAddSource={onAddSource}
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
        ) : (
          <div className="text-[13px] text-(--muted-2)">{TAB_PLACEHOLDER[activeTab]}</div>
        )}
      </div>
    </div>
  );
}

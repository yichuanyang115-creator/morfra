import { useEffect, useMemo, useState } from "react";
import type { Deliverable } from "../../../types/models";
import type { ActivityEvent, RecordDetailContent, StorageDetailTab } from "../../../types/domain";
import { TabBar } from "../TabBar";
import { BodyTab } from "./BodyTab";
import { DeliverablesTab } from "./DeliverablesTab";
import { TasksTab } from "./TasksTab";
import { AcceptanceTab } from "./AcceptanceTab";
import type { TaskPatch } from "./taskShared";
import type { AcceptancePatch } from "./acceptanceShared";
import { StorageActivityTab } from "./StorageActivityTab";

interface StorageRecordDetailTabsProps {
  tabs: StorageDetailTab[];
  content: RecordDetailContent;
  contentLoading: boolean;
  events: ActivityEvent[];
  eventsLoading: boolean;
  eventsError: string | null;
  onSaveContent: (content: RecordDetailContent) => void;
  onOpenActivitySettings: () => void;
  onUpdateActivityNote: (eventId: string, note: string | null) => Promise<void>;
  onAddActivityComment: (eventId: string, content: string) => Promise<void>;
  onDeleteActivityEvent: (eventId: string) => Promise<void>;
}

function newId(prefix: string): string {
  const suffix = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function StorageRecordDetailTabs({
  tabs,
  content,
  contentLoading,
  events,
  eventsLoading,
  eventsError,
  onSaveContent,
  onOpenActivitySettings,
  onUpdateActivityNote,
  onAddActivityComment,
  onDeleteActivityEvent,
}: StorageRecordDetailTabsProps) {
  const visibleTabs = useMemo(() => tabs.filter((tab) => tab.visible), [tabs]);
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id ?? "");
  const [deliverableDraftOpen, setDeliverableDraftOpen] = useState(false);
  const [taskDraftOpen, setTaskDraftOpen] = useState(false);
  const [acceptanceDraftOpen, setAcceptanceDraftOpen] = useState(false);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id ?? "");
    }
  }, [activeTab, visibleTabs]);

  if (visibleTabs.length === 0) return null;

  const current = visibleTabs.find((tab) => tab.id === activeTab) ?? visibleTabs[0];
  const replaceContent = (next: Partial<RecordDetailContent>) => onSaveContent({ ...content, ...next });
  const patchDeliverable = (id: string, patch: Partial<Pick<Deliverable, "name" | "checked" | "attach">>) => {
    replaceContent({ deliverables: content.deliverables.map((item) => item.id === id ? { ...item, ...patch } : item) });
  };
  const patchTask = (id: string, patch: TaskPatch) => {
    replaceContent({ tasks: content.tasks.map((item) => item.id === id ? { ...item, ...patch } : item) });
  };
  const patchAcceptance = (id: string, patch: AcceptancePatch) => {
    replaceContent({ acceptance: content.acceptance.map((item) => item.id === id ? { ...item, ...patch } : item) });
  };

  return (
    <section className="border-t border-(--module-scope-border-subtle) pt-3" aria-label="记录详情 Tab">
      <TabBar tabs={visibleTabs} activeTab={current.id} onSelectTab={setActiveTab} slot={tabAction(current.renderer)} />
      <div className="pt-4">
        {contentLoading && current.renderer !== "activity" ? <p className="text-[12px] text-(--module-scope-text-tertiary)">正在加载详情内容…</p> : null}
        {!contentLoading && current.renderer === "body" ? <BodyTab markdown={content.body} onChange={(body) => replaceContent({ body })} onEditorReady={() => undefined} /> : null}
        {!contentLoading && current.renderer === "deliverables" ? (
          <DeliverablesTab
            deliverables={content.deliverables}
            draftOpen={deliverableDraftOpen}
            onCreate={(name) => {
              replaceContent({ deliverables: [...content.deliverables, { id: newId("deliverable"), name, checked: false, attach: null, createdAt: new Date().toISOString() }] });
              setDeliverableDraftOpen(false);
            }}
            onCancelDraft={() => setDeliverableDraftOpen(false)}
            onUpdate={patchDeliverable}
            onRemove={(id) => replaceContent({ deliverables: content.deliverables.filter((item) => item.id !== id) })}
          />
        ) : null}
        {!contentLoading && current.renderer === "tasks" ? (
          <TasksTab
            tasks={content.tasks}
            draftOpen={taskDraftOpen}
            onCreate={(task) => {
              replaceContent({ tasks: [...content.tasks, { id: newId("task"), ...task, status: "todo", blocked: false, blockNote: "", createdAt: new Date().toISOString() }] });
              setTaskDraftOpen(false);
            }}
            onCancelDraft={() => setTaskDraftOpen(false)}
            onUpdate={patchTask}
            onRemove={(id) => replaceContent({ tasks: content.tasks.filter((item) => item.id !== id) })}
          />
        ) : null}
        {!contentLoading && current.renderer === "acceptance" ? (
          <AcceptanceTab
            acceptance={content.acceptance}
            draftOpen={acceptanceDraftOpen}
            onCreate={(desc) => {
              replaceContent({ acceptance: [...content.acceptance, { id: newId("acceptance"), desc, result: "unverified", failNote: "", createdAt: new Date().toISOString() }] });
              setAcceptanceDraftOpen(false);
            }}
            onCancelDraft={() => setAcceptanceDraftOpen(false)}
            onUpdate={patchAcceptance}
            onRemove={(id) => replaceContent({ acceptance: content.acceptance.filter((item) => item.id !== id) })}
          />
        ) : null}
        {current.renderer === "activity" ? <StorageActivityTab events={events} loading={eventsLoading} error={eventsError} onUpdateNote={onUpdateActivityNote} onAddComment={onAddActivityComment} onDelete={onDeleteActivityEvent} /> : null}
      </div>
    </section>
  );

  function tabAction(renderer: StorageDetailTab["renderer"]) {
    if (renderer === "deliverables") return <button type="button" aria-label="新建产出" onClick={() => setDeliverableDraftOpen(true)}>+</button>;
    if (renderer === "tasks") return <button type="button" aria-label="新建任务" onClick={() => setTaskDraftOpen(true)}>+</button>;
    if (renderer === "acceptance") return <button type="button" aria-label="新建验收标准" onClick={() => setAcceptanceDraftOpen(true)}>+</button>;
    if (renderer === "activity") return <button type="button" className="text-[11px]" onClick={onOpenActivitySettings}>活动设置</button>;
    return undefined;
  }
}

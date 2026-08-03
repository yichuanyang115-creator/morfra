import { useEffect, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { TabDefinition } from "../../types/schema";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { TabRow } from "./TabRow";
import { newTabId } from "../../stores/schemaStore";

function PlusIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface TabManagerProps {
  tabs: TabDefinition[];
  /** 左侧导航当前选中的 Tab（section.kind === "tab" 时的 tabId），进入时自动展开对应行的详情。 */
  selectedTabId: string;
  onReorder: (orderedIds: string[]) => void;
  onAdd: (tab: TabDefinition) => void;
  onUpdate: (tabId: string, patch: Partial<TabDefinition>) => void;
  onRemove: (tabId: string) => void;
}

/**
 * Tab 管理区：设计取"列表 + 详情合一"，与 StageManager 同构——列表本身承载排序/显隐/新建/删除
 * 这些全局性操作（Product-Spec 明确要求），点击某一行展开该 Tab 的详情编辑（改名/渲染器只读/字段配置占位）。
 * 左侧导航点击某个 Tab 名进入本区域时，通过 selectedTabId 自动展开对应行，
 * 而不是另起一套"仅显示单个 Tab"的视图——这样能同时满足"列表"和"单 Tab 详情"两个入口，不重复实现。
 */
export function TabManager({ tabs, selectedTabId, onReorder, onAdd, onUpdate, onRemove }: TabManagerProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [expandedId, setExpandedId] = useState<string | null>(selectedTabId);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    setExpandedId(selectedTabId);
  }, [selectedTabId]);

  function handleDragEnd(event: DragEndEvent) {
    const activeId = event.active.id;
    const overId = event.over?.id;
    if (overId == null || activeId === overId) return;

    const oldIndex = tabs.findIndex((t) => t.id === activeId);
    const newIndex = tabs.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tabs, oldIndex, newIndex);
    onReorder(reordered.map((t) => t.id));
  }

  function submitDraft() {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    // 用户自建 Tab 用通用渲染器（Schema-自定义机制-讨论稿 §6.2）。
    onAdd({ id: newTabId(), name: trimmed, renderer: "generic", visible: true });
    setDraftName("");
  }

  const deleteTarget = tabs.find((t) => t.id === deleteTargetId) ?? null;

  return (
    <div className="p-4">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tabs.map((tab) => (
            <TabRow
              key={tab.id}
              tab={tab}
              expanded={expandedId === tab.id}
              onToggleExpand={() => setExpandedId((cur) => (cur === tab.id ? null : tab.id))}
              onUpdate={(patch) => onUpdate(tab.id, patch)}
              onRequestDelete={() => setDeleteTargetId(tab.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitDraft();
        }}
        className="mt-2 flex items-center gap-1.5"
      >
        <input
          type="text"
          placeholder="新 Tab 名称"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          className="min-w-0 flex-1 rounded-(--r-sm) border border-(--border) bg-(--surface) px-2 py-1.5 font-(family-name:--font-body) text-[12.5px] text-(--fg) outline-none focus:border-(--accent)"
        />
        <button
          type="submit"
          aria-label="新建 Tab"
          className="inline-flex flex-none items-center gap-1 rounded-(--r-sm) border-none bg-(--fg) px-2.5 py-1.5 text-[12.5px] text-(--surface) hover:opacity-90"
        >
          <PlusIcon />
          新建 Tab
        </button>
      </form>

      {deleteTarget && (
        <ConfirmDialog
          title={`删除 Tab「${deleteTarget.name}」？`}
          body="该 Tab 下全部记录将被永久清除，此操作不可撤销。"
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={() => {
            onRemove(deleteTarget.id);
            setDeleteTargetId(null);
          }}
        />
      )}
    </div>
  );
}

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TabDefinition, TabRenderer } from "../../types/schema";
import { TabEditor } from "./TabEditor";

function ChevronIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M6 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DragHandleIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="6" r="1.1" fill="currentColor" />
      <circle cx="7" cy="10" r="1.1" fill="currentColor" />
      <circle cx="7" cy="14" r="1.1" fill="currentColor" />
      <circle cx="13" cy="6" r="1.1" fill="currentColor" />
      <circle cx="13" cy="10" r="1.1" fill="currentColor" />
      <circle cx="13" cy="14" r="1.1" fill="currentColor" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M2 10s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M2 10s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** 固定特例：正文和活动 Tab 只有"是否显示"开关，不可删除（Product-Spec REQ-025 / 讨论稿 §6.3）。 */
function isFixedSpecialTab(renderer: TabRenderer): boolean {
  return renderer === "body" || renderer === "activity";
}

interface TabRowProps {
  tab: TabDefinition;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<TabDefinition>) => void;
  onRequestDelete: () => void;
}

export function TabRow({ tab, expanded, onToggleExpand, onUpdate, onRequestDelete }: TabRowProps) {
  const { attributes: sortableAttributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: tab.id,
  });
  const deleteDisabled = isFixedSpecialTab(tab.renderer);
  const deleteDisabledReason = deleteDisabled ? "正文/活动为固定特例，仅可设置显隐" : `删除 Tab「${tab.name}」`;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`mb-1.5 rounded-(--r-md) border border-(--border) ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span {...listeners} {...sortableAttributes} className="flex-none cursor-grab text-(--muted-2) hover:text-(--accent-text)">
          <DragHandleIcon />
        </span>
        <button
          type="button"
          aria-label={tab.visible ? `隐藏 Tab「${tab.name}」` : `显示 Tab「${tab.name}」`}
          onClick={() => onUpdate({ visible: !tab.visible })}
          className={`grid size-6.5 flex-none place-items-center rounded-(--r-sm) hover:bg-(--accent-soft) ${
            tab.visible ? "text-(--fg)" : "text-(--muted-2)"
          }`}
        >
          {tab.visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
        <button type="button" onClick={onToggleExpand} className="flex flex-1 items-center gap-2 border-none bg-transparent p-0 text-left">
          <span className="flex-1 truncate font-(family-name:--font-body) text-[13px] text-(--fg)">{tab.name}</span>
          {tab.renderer !== "generic" && (
            <span className="flex-none rounded-(--r-sm) bg-(--accent-selected) px-1.5 py-0.5 font-(family-name:--font-mono) text-[10.5px] text-(--context-strong)">
              预制
            </span>
          )}
          <span className={`flex-none text-(--muted-2) transition-transform ${expanded ? "rotate-90" : ""}`}>
            <ChevronIcon />
          </span>
        </button>
        <button
          type="button"
          aria-label={deleteDisabledReason}
          disabled={deleteDisabled}
          title={deleteDisabledReason}
          onClick={onRequestDelete}
          className="grid size-6.5 flex-none place-items-center rounded-(--r-sm) text-(--muted-2) disabled:cursor-not-allowed disabled:opacity-40 hover:bg-(--st-blocked-soft) hover:text-(--st-blocked)"
        >
          <DeleteIcon />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-(--border) p-2.5">
          <TabEditor tab={tab} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Attribute, StageOption } from "../../types/schema";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { StageEditor } from "./StageEditor";
import { paletteColorAt } from "../../lib/stagePalette";
import { newStageOptionId } from "../../stores/schemaStore";

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

function PlusIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface StageRowProps {
  stageOption: StageOption;
  entityCount: number;
  /** Stage 选项最少 1 个，不允许清空到 0（Product-Spec REQ-025 MUST）：仅剩这一个时删除按钮禁用。 */
  isLastStage: boolean;
  expanded: boolean;
  availableAttributes: Attribute[];
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<StageOption>) => void;
  onRequestDelete: () => void;
}

function StageRow({
  stageOption,
  entityCount,
  isLastStage,
  expanded,
  availableAttributes,
  onToggleExpand,
  onUpdate,
  onRequestDelete,
}: StageRowProps) {
  const { attributes: sortableAttributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: stageOption.id,
  });
  const deleteDisabled = entityCount > 0 || isLastStage;
  const deleteDisabledReason = entityCount > 0 ? "该阶段下还有实体，无法删除" : isLastStage ? "至少保留一个阶段" : "删除阶段";

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
        <button type="button" onClick={onToggleExpand} className="flex flex-1 items-center gap-2 border-none bg-transparent p-0 text-left">
          <span className="flex-none size-3 rounded-(--r-sm)" style={{ backgroundColor: stageOption.color }} />
          <span className="flex-1 truncate font-(family-name:--font-body) text-[13px] text-(--fg)">{stageOption.label}</span>
          {stageOption.isTerminal && (
            <span className="flex-none rounded-(--r-sm) bg-(--accent-selected) px-1.5 py-0.5 font-(family-name:--font-mono) text-[10.5px] text-(--context-strong)">
              终态
            </span>
          )}
          <span className="flex-none font-(family-name:--font-mono) text-[11px] text-(--muted-2)">{entityCount}</span>
          <span className={`flex-none text-(--muted-2) transition-transform ${expanded ? "rotate-90" : ""}`}>
            <ChevronIcon />
          </span>
        </button>
        <button
          type="button"
          aria-label={`删除阶段「${stageOption.label}」`}
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
          <StageEditor stageOption={stageOption} availableAttributes={availableAttributes} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

interface StageManagerProps {
  stageOptions: StageOption[];
  /** 各阶段下当前实体数量，用于删除保护（有实体时禁止删除，见 Product-Spec REQ-025）。 */
  entityCountByStage: Record<string, number>;
  availableAttributes: Attribute[];
  onReorder: (orderedIds: string[]) => void;
  onAdd: (stageOption: StageOption) => void;
  onUpdate: (stageOptionId: string, patch: Partial<StageOption>) => void;
  onRemove: (stageOptionId: string) => void;
}

export function StageManager({
  stageOptions,
  entityCountByStage,
  availableAttributes,
  onReorder,
  onAdd,
  onUpdate,
  onRemove,
}: StageManagerProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  function handleDragEnd(event: DragEndEvent) {
    const activeId = event.active.id;
    const overId = event.over?.id;
    if (overId == null || activeId === overId) return;

    const oldIndex = stageOptions.findIndex((s) => s.id === activeId);
    const newIndex = stageOptions.findIndex((s) => s.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(stageOptions, oldIndex, newIndex);
    onReorder(reordered.map((s) => s.id));
  }

  function submitDraft() {
    const trimmed = draftLabel.trim();
    if (!trimmed) return;
    onAdd({ id: newStageOptionId(), label: trimmed, color: paletteColorAt(stageOptions.length), isTerminal: false });
    setDraftLabel("");
  }

  const deleteTarget = stageOptions.find((s) => s.id === deleteTargetId) ?? null;

  return (
    <div className="p-4">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={stageOptions.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {stageOptions.map((stageOption) => (
            <StageRow
              key={stageOption.id}
              stageOption={stageOption}
              entityCount={entityCountByStage[stageOption.id] ?? 0}
              isLastStage={stageOptions.length <= 1}
              expanded={expandedId === stageOption.id}
              availableAttributes={availableAttributes}
              onToggleExpand={() => setExpandedId((cur) => (cur === stageOption.id ? null : stageOption.id))}
              onUpdate={(patch) => onUpdate(stageOption.id, patch)}
              onRequestDelete={() => setDeleteTargetId(stageOption.id)}
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
          placeholder="新阶段名称"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          className="min-w-0 flex-1 rounded-(--r-sm) border border-(--border) bg-(--surface) px-2 py-1.5 font-(family-name:--font-body) text-[12.5px] text-(--fg) outline-none focus:border-(--accent)"
        />
        <button
          type="submit"
          aria-label="新建阶段"
          className="inline-flex flex-none items-center gap-1 rounded-(--r-sm) border-none bg-(--accent-solid) px-2.5 py-1.5 text-[12.5px] text-(--accent-solid-fg) hover:opacity-90"
        >
          <PlusIcon />
          新建阶段
        </button>
      </form>

      {deleteTarget && (
        <ConfirmDialog
          title={`删除阶段「${deleteTarget.label}」？`}
          body="此操作不可撤销，删除后需要该阶段选项的看板分组会一并消失。"
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

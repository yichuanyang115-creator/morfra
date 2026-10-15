import { useEffect, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Attribute, AttributeType } from "../../types/schema";
import { ATTRIBUTE_TYPE_LABEL, USER_ASSIGNABLE_TYPES } from "../../lib/attributeTypeLabels";
import { newAttributeId } from "../../stores/schemaStore";

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

function PlusIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface FieldRowProps {
  attribute: Attribute;
  onToggleBoard: (attributeId: string, next: boolean) => void;
}

/**
 * 字段面板里的一行属性：拖拽把手 + 眼睛图标（看板显隐）+ 名称 + 类型标签。
 * 眼睛图标写的是属性自身的 showOnBoard，与 Schema 设置页属性行的眼睛图标
 * 共用同一字段（REQ-025 MUST"看板顶部条字段面板也能控制看板显隐（联动）"）。
 */
function FieldRow({ attribute, onToggleBoard }: FieldRowProps) {
  const { attributes: sortableAttributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: attribute.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-(--r-sm) px-1.5 py-1.5 ${isDragging ? "opacity-40" : ""}`}
    >
      <span {...listeners} {...sortableAttributes} className="flex-none cursor-grab text-(--module-scope-text-tertiary) hover:text-(--module-scope-action-strong)">
        <DragHandleIcon />
      </span>
      <button
        type="button"
        aria-label={attribute.showOnBoard ? `隐藏「${attribute.name}」看板列` : `显示「${attribute.name}」看板列`}
        onClick={() => onToggleBoard(attribute.id, !attribute.showOnBoard)}
        className={`grid size-6.5 flex-none place-items-center rounded-(--r-sm) hover:bg-(--module-scope-action-soft) ${
          attribute.showOnBoard ? "text-(--module-scope-text-primary)" : "text-(--module-scope-text-tertiary)"
        }`}
      >
        {attribute.showOnBoard ? <EyeIcon /> : <EyeOffIcon />}
      </button>
      <span className="flex-1 truncate text-[12.5px] text-(--module-scope-text-primary)">{attribute.name}</span>
      <span className="flex-none rounded-(--r-sm) bg-(--module-scope-background-elevated) px-1.5 py-0.5 font-(family-name:--font-mono) text-[10.5px] text-(--module-scope-text-secondary)">
        {ATTRIBUTE_TYPE_LABEL[attribute.type]}
      </span>
    </div>
  );
}

interface FieldsPanelProps {
  /** 全部属性（含已从看板隐藏的），已按 columnOrder 排序（见 schemaSelectors.fieldAttributesFor）。 */
  attributes: Attribute[];
  /** 切换看板显隐：写属性自身 showOnBoard，与设置页眼睛图标联动。 */
  onToggleBoard: (attributeId: string, next: boolean) => void;
  /** 拖拽排序松手：携带完整新顺序，写入 viewPreferences.columnOrder（与表头拖拽同源）。 */
  onReorder: (orderedIds: string[]) => void;
  onAdd: (attribute: Attribute) => void;
  onClose: () => void;
}

/**
 * 顶栏"字段"按钮弹出的字段管理下拉面板（REQ-002 MUST：属性列表+眼睛图标看板显隐+
 * 拖拽排序+底部新建属性）。浮层样式对齐 SettingsPanel（same 定位/色/阴影 token）。
 * 点击外部由 Topbar 的透明遮罩关闭，Esc 在这里兜底。
 */
export function FieldsPanel({ attributes, onToggleBoard, onReorder, onAdd, onClose }: FieldsPanelProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<AttributeType>("text");
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleDragEnd(event: DragEndEvent) {
    const activeId = event.active.id;
    const overId = event.over?.id;
    if (overId == null || activeId === overId) return;
    const oldIndex = attributes.findIndex((a) => a.id === activeId);
    const newIndex = attributes.findIndex((a) => a.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(attributes, oldIndex, newIndex).map((a) => a.id));
  }

  function submitDraft() {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    if (attributes.some((a) => a.name === trimmed)) {
      setDraftError("同名属性已存在");
      return;
    }
    onAdd({ id: newAttributeId(), name: trimmed, type: draftType, options: [], showOnBoard: true, showOnDetail: true });
    setDraftName("");
    setDraftType("text");
    setDraftError(null);
  }

  return (
    <div
      className="fixed right-3 z-50 w-72 rounded-(--r-lg) border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) p-3.5 shadow-(--shadow-floating)"
      style={{ top: "calc(var(--topbar-h) + 6px)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-(family-name:--font-display) text-[13px] font-[590] text-(--module-scope-text-primary)">字段</span>
      </div>

      {attributes.length === 0 ? (
        <p className="m-0 py-2 text-center text-[12px] text-(--module-scope-text-tertiary)">还没有字段，在下方新建一个</p>
      ) : (
        <div className="max-h-56 overflow-y-auto border-t border-(--module-scope-border-subtle) pt-1">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={attributes.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              {attributes.map((attribute) => (
                <FieldRow key={attribute.id} attribute={attribute} onToggleBoard={onToggleBoard} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitDraft();
        }}
        className="mt-2 flex items-center gap-1.5 border-t border-(--module-scope-border-subtle) pt-2.5"
      >
        <input
          type="text"
          placeholder="新属性名称"
          value={draftName}
          onChange={(e) => {
            setDraftName(e.target.value);
            setDraftError(null);
          }}
          className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1.5 font-(family-name:--font-body) text-[12.5px] text-(--module-scope-text-primary) outline-none focus:border-(--module-scope-action-base)"
        />
        <select
          value={draftType}
          aria-label="新属性类型"
          onChange={(e) => setDraftType(e.target.value as AttributeType)}
          className="flex-none rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-1.5 py-1.5 text-[12px] text-(--module-scope-text-primary) outline-none"
        >
          {USER_ASSIGNABLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {ATTRIBUTE_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          aria-label="新建属性"
          className="inline-flex flex-none items-center gap-1 rounded-(--r-sm) border-none bg-(--module-scope-action-strong) px-2.5 py-1.5 text-[12.5px] text-(--module-scope-background-surface) hover:opacity-90"
        >
          <PlusIcon />
          新建
        </button>
      </form>
      {draftError && <p className="m-0 mt-1 text-[11.5px] text-(--module-scope-feedback-danger)">{draftError}</p>}
    </div>
  );
}

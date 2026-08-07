import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Attribute, AttributeType } from "../../types/schema";
import { AttributeEditor } from "./AttributeEditor";
import { ATTRIBUTE_TYPE_LABEL } from "../../lib/attributeTypeLabels";

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

interface AttributeRowProps {
  attribute: Attribute;
  expanded: boolean;
  availableAttributes: Attribute[];
  onToggleExpand: () => void;
  onToggleBoard: () => void;
  onToggleDetail: () => void;
  onUpdate: (patch: Partial<Attribute>) => void;
  onRename: (name: string) => { ok: boolean; message?: string };
  onRequestTypeChange: (toType: AttributeType) => void;
  onRequestDelete: () => void;
}

export function AttributeRow({
  attribute,
  expanded,
  availableAttributes,
  onToggleExpand,
  onToggleBoard,
  onToggleDetail,
  onUpdate,
  onRename,
  onRequestTypeChange,
  onRequestDelete,
}: AttributeRowProps) {
  const { attributes: sortableAttributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: attribute.id,
  });

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
          aria-label={attribute.showOnBoard ? `隐藏「${attribute.name}」看板列` : `显示「${attribute.name}」看板列`}
          title="看板显示"
          onClick={onToggleBoard}
          className={`grid size-6.5 flex-none place-items-center rounded-(--r-sm) hover:bg-(--accent-soft) ${
            attribute.showOnBoard ? "text-(--fg)" : "text-(--muted-2)"
          }`}
        >
          {attribute.showOnBoard ? <EyeIcon /> : <EyeOffIcon />}
        </button>
        <button
          type="button"
          aria-label={attribute.showOnDetail ? `隐藏「${attribute.name}」详情页属性` : `显示「${attribute.name}」详情页属性`}
          title="详情页显示"
          onClick={onToggleDetail}
          className={`grid size-6.5 flex-none place-items-center rounded-(--r-sm) hover:bg-(--accent-soft) ${
            attribute.showOnDetail ? "text-(--fg)" : "text-(--muted-2)"
          }`}
        >
          {attribute.showOnDetail ? <EyeIcon /> : <EyeOffIcon />}
        </button>
        <button type="button" onClick={onToggleExpand} className="flex flex-1 items-center gap-2 border-none bg-transparent p-0 text-left">
          <span className="flex-1 truncate font-(family-name:--font-body) text-[13px] text-(--fg)">{attribute.name}</span>
          <span className="flex-none rounded-(--r-sm) bg-(--surface-2) px-1.5 py-0.5 font-(family-name:--font-mono) text-[10.5px] text-(--muted)">
            {ATTRIBUTE_TYPE_LABEL[attribute.type]}
          </span>
          <span className={`flex-none text-(--muted-2) transition-transform ${expanded ? "rotate-90" : ""}`}>
            <ChevronIcon />
          </span>
        </button>
        <button
          type="button"
          aria-label={`删除属性「${attribute.name}」`}
          onClick={onRequestDelete}
          className="grid size-6.5 flex-none place-items-center rounded-(--r-sm) text-(--muted-2) hover:bg-(--st-blocked-soft) hover:text-(--st-blocked)"
        >
          <DeleteIcon />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-(--border) p-2.5">
          <AttributeEditor
            attribute={attribute}
            availableAttributes={availableAttributes}
            typeChangeLocked={attribute.type === "computed"}
            onUpdate={onUpdate}
            onRename={onRename}
            onRequestTypeChange={onRequestTypeChange}
          />
        </div>
      )}
    </div>
  );
}

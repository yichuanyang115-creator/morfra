import { useEffect, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Attribute, AttributeType } from "../../types/schema";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { AttributeRow } from "./AttributeRow";
import { ATTRIBUTE_TYPE_LABEL, USER_ASSIGNABLE_TYPES } from "../../lib/attributeTypeLabels";
import { newAttributeId } from "../../stores/schemaStore";

function PlusIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface TypeChangeImpact {
  totalCount: number;
  lostCount: number;
}

interface AttributeManagerProps {
  attributes: Attribute[];
  /** 从右键表头"编辑此属性"跳转进入时携带的目标属性 id，进入时自动展开对应行（见 REQ-025 设置页入口）。 */
  selectedAttributeId?: string;
  onReorder: (orderedIds: string[]) => void;
  onAdd: (attribute: Attribute) => void;
  onUpdate: (attributeId: string, patch: Partial<Attribute>) => void;
  onRemove: (attributeId: string) => void;
  /** 该属性当前有多少条记录填了非空值，用于删除二次确认的影响提示（Product-Spec REQ-025："删属性：级联清值，二次确认"）。 */
  countValued: (attributeId: string) => number;
  /** 改类型的有损影响统计，用于有损确认弹窗（Product-Spec REQ-025："有损时弹确认告知影响条数"）。 */
  getTypeChangeImpact: (attributeId: string, toType: AttributeType) => TypeChangeImpact;
  /** 确认后真正落地类型变更：更新 schema 属性类型/选项 + 级联转换全部记录的该属性值。 */
  onConfirmTypeChange: (attributeId: string, toType: AttributeType) => void;
}

export function AttributeManager({
  attributes,
  selectedAttributeId,
  onReorder,
  onAdd,
  onUpdate,
  onRemove,
  countValued,
  getTypeChangeImpact,
  onConfirmTypeChange,
}: AttributeManagerProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [expandedId, setExpandedId] = useState<string | null>(selectedAttributeId ?? null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [typeChangeRequest, setTypeChangeRequest] = useState<{ attributeId: string; toType: AttributeType; impact: TypeChangeImpact } | null>(
    null,
  );
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<AttributeType>("text");
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAttributeId) setExpandedId(selectedAttributeId);
  }, [selectedAttributeId]);

  function handleDragEnd(event: DragEndEvent) {
    const activeId = event.active.id;
    const overId = event.over?.id;
    if (overId == null || activeId === overId) return;

    const oldIndex = attributes.findIndex((a) => a.id === activeId);
    const newIndex = attributes.findIndex((a) => a.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(attributes, oldIndex, newIndex);
    onReorder(reordered.map((a) => a.id));
  }

  function renameAttribute(attributeId: string, name: string): { ok: boolean; message?: string } {
    const conflict = attributes.some((a) => a.id !== attributeId && a.name === name);
    if (conflict) return { ok: false, message: "同名属性已存在" };
    onUpdate(attributeId, { name });
    return { ok: true };
  }

  function requestTypeChange(attributeId: string, toType: AttributeType) {
    const impact = getTypeChangeImpact(attributeId, toType);
    if (impact.lostCount > 0) {
      setTypeChangeRequest({ attributeId, toType, impact });
    } else {
      onConfirmTypeChange(attributeId, toType);
    }
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

  const deleteTarget = attributes.find((a) => a.id === deleteTargetId) ?? null;
  const deleteImpactCount = deleteTarget ? countValued(deleteTarget.id) : 0;

  return (
    <div className="p-4">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={attributes.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          {attributes.map((attribute) => (
            <AttributeRow
              key={attribute.id}
              attribute={attribute}
              expanded={expandedId === attribute.id}
              availableAttributes={attributes.filter((a) => a.id !== attribute.id)}
              onToggleExpand={() => setExpandedId((cur) => (cur === attribute.id ? null : attribute.id))}
              onToggleBoard={() => onUpdate(attribute.id, { showOnBoard: !attribute.showOnBoard })}
              onToggleDetail={() => onUpdate(attribute.id, { showOnDetail: !attribute.showOnDetail })}
              onUpdate={(patch) => onUpdate(attribute.id, patch)}
              onRename={(name) => renameAttribute(attribute.id, name)}
              onRequestTypeChange={(toType) => requestTypeChange(attribute.id, toType)}
              onRequestDelete={() => setDeleteTargetId(attribute.id)}
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
          新建属性
        </button>
      </form>
      {draftError && <p className="m-0 mt-1 text-[11.5px] text-(--module-scope-feedback-danger)">{draftError}</p>}

      {deleteTarget && (
        <ConfirmDialog
          title={`删除属性「${deleteTarget.name}」？`}
          body={
            deleteImpactCount > 0
              ? `当前有 ${deleteImpactCount} 条记录填了该属性的值，删除后这些值一并清除，此操作不可撤销。`
              : "此操作不可撤销。"
          }
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={() => {
            onRemove(deleteTarget.id);
            setDeleteTargetId(null);
          }}
        />
      )}

      {typeChangeRequest && (
        <ConfirmDialog
          title="改变属性类型？"
          body={`${typeChangeRequest.impact.totalCount} 条记录中有 ${typeChangeRequest.impact.lostCount} 条无法转换将被清空，此操作不可撤销。`}
          confirmLabel="改变类型"
          onCancel={() => setTypeChangeRequest(null)}
          onConfirm={() => {
            onConfirmTypeChange(typeChangeRequest.attributeId, typeChangeRequest.toType);
            setTypeChangeRequest(null);
          }}
        />
      )}
    </div>
  );
}

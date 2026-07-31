import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Requirement } from "../../types/models";
import type { Attribute } from "../../types/schema";
import { FieldCell } from "./FieldCell";
import { gridTemplateColumnsFor } from "../../lib/boardWidth";

interface RequirementRowProps {
  requirement: Requirement;
  /** 已按 schema 可见属性顺序排好的属性列表（showOnBoard 过滤 + 排序在调用方完成）。 */
  attributes: Attribute[];
  selected: boolean;
  /** 该行所属阶段是否终态：终态阶段的"结果"类属性只读，不允许在看板行内改（值由流转产生）。 */
  isTerminal: boolean;
  onSelect: () => void;
  onAttributeChange: (attributeId: string, value: unknown) => void;
}

export function RequirementRow({
  requirement,
  attributes,
  selected,
  isTerminal,
  onSelect,
  onAttributeChange,
}: RequirementRowProps) {
  const { attributes: sortableAttributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: requirement.id,
    disabled: isTerminal,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...sortableAttributes}
      onClick={onSelect}
      style={{
        gridTemplateColumns: gridTemplateColumnsFor(attributes),
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`grid w-fit min-w-full cursor-pointer items-center gap-3 border-b border-(--border) px-2 py-2 ${
        isDragging ? "opacity-40" : ""
      } ${selected ? "bg-(--accent-selected)" : "hover:bg-(--surface)"}`}
    >
      <div
        className={`sticky left-0 flex min-w-0 items-center gap-1.5 pr-2 text-[13px] text-(--fg) ${
          selected ? "bg-(--accent-selected)" : "bg-(--surface)"
        }`}
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{requirement.name}</span>
      </div>
      {attributes.map((attribute) => (
        <FieldCell
          key={attribute.id}
          attribute={attribute}
          requirement={requirement}
          readOnly={isTerminal && attribute.id === "result"}
          onChange={(value) => onAttributeChange(attribute.id, value)}
        />
      ))}
    </div>
  );
}

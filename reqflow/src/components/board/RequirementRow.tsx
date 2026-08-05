import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Requirement } from "../../types/models";
import type { Attribute } from "../../types/schema";
import { FieldCell } from "./FieldCell";
import { BOARD_COLUMN_GAP, frozenOffsetsFor, gridTemplateColumnsFor } from "../../lib/boardWidth";

interface RequirementRowProps {
  requirement: Requirement;
  /** 已按 schema 可见属性顺序排好的属性列表（showOnBoard 过滤 + 排序在调用方完成）。 */
  attributes: Attribute[];
  /** 用户拖拽调整过的列宽，需要跟表头用同一份值才能保持列对齐（见 BoardHeader.tsx）。 */
  columnWidths: Record<string, number>;
  /** 冻结的属性列数：前 frozenCount 个属性列 position:sticky，横向滚动时钉住（REQ-001 MUST）。 */
  frozenCount: number;
  selected: boolean;
  /** 该行所属阶段是否终态：终态阶段的"结果"类属性只读，不允许在看板行内改（值由流转产生）。 */
  isTerminal: boolean;
  onSelect: () => void;
  onAttributeChange: (attributeId: string, value: unknown) => void;
}

export function RequirementRow({
  requirement,
  attributes,
  columnWidths,
  frozenCount,
  selected,
  isTerminal,
  onSelect,
  onAttributeChange,
}: RequirementRowProps) {
  const { attributes: sortableAttributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: requirement.id,
    disabled: isTerminal,
  });

  const frozenOffsets = useMemo(
    () => frozenOffsetsFor(attributes, columnWidths, frozenCount),
    [attributes, columnWidths, frozenCount],
  );

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...sortableAttributes}
      onClick={onSelect}
      style={{
        gridTemplateColumns: gridTemplateColumnsFor(attributes, columnWidths),
        columnGap: BOARD_COLUMN_GAP,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`grid w-fit min-w-full cursor-pointer items-center border-b border-(--border) px-2 py-2 ${
        isDragging ? "opacity-40" : ""
      } ${selected ? "bg-(--accent-selected)" : "hover:bg-(--surface)"}`}
    >
      <div
        className={`sticky left-0 z-1 flex min-w-0 items-center gap-1.5 pr-2 text-[13px] text-(--fg) ${
          selected ? "bg-(--accent-selected)" : "bg-(--surface)"
        }`}
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{requirement.name}</span>
      </div>
      {attributes.map((attribute, index) => {
        const frozen = index < frozenCount;
        // 冻结的属性列：外层包 sticky 定位的 div，背景跟随行的选中态，与 Name 列同款
        // 覆盖方式（滚动时遮住从下方滑过的非冻结列）。偏移由 frozenOffsetsFor 累加算出。
        // 只包冻结列，非冻结列保持原样直接渲染 FieldCell，避免无关 DOM 结构变动。
        if (frozen) {
          return (
            <div
              key={attribute.id}
              style={{ left: frozenOffsets[attribute.id] }}
              className={`sticky z-1 ${selected ? "bg-(--accent-selected)" : "bg-(--surface)"}`}
            >
              <FieldCell
                attribute={attribute}
                requirement={requirement}
                readOnly={isTerminal && attribute.id === "result"}
                onChange={(value) => onAttributeChange(attribute.id, value)}
              />
            </div>
          );
        }
        return (
          <FieldCell
            key={attribute.id}
            attribute={attribute}
            requirement={requirement}
            readOnly={isTerminal && attribute.id === "result"}
            onChange={(value) => onAttributeChange(attribute.id, value)}
          />
        );
      })}
    </div>
  );
}

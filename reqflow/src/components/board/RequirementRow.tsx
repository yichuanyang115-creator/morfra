import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Requirement } from "../../types/models";
import type { Attribute, AttributeOverride } from "../../types/schema";
import { FieldCell } from "./FieldCell";
import { BOARD_COLUMN_GAP, frozenOffsetsFor, gridTemplateColumnsFor } from "../../lib/boardWidth";
import { dependencySatisfied } from "../../lib/dependencyEngine";
import { resolveStageOverrides } from "../../lib/overrideEngine";

interface RequirementRowProps {
  requirement: Requirement;
  /**
   * 原始列位属性列表（showOnBoard 过滤 + 排序在调用方完成）。列宽/冻结偏移/列位顺序都以
   * 这一份为准——被覆盖列位的内容属性换了，但列位本身（对齐锚）不变。
   */
  attributes: Attribute[];
  /** 全部属性（schema.attributes），用于把覆盖 to 属性解析成完整 Attribute 对象（可能 showOnBoard:false）。 */
  allAttributes?: Attribute[];
  /** 该行所属阶段的覆盖规则（阶段属性覆盖，REQ-025：某阶段下属性列位被替换）。 */
  overrides?: AttributeOverride[];
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
  allAttributes,
  overrides,
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

  const allById = useMemo(
    () => new Map((allAttributes ?? attributes).map((a) => [a.id, a])),
    [allAttributes, attributes],
  );

  // 覆盖引擎只替换"内容属性"：占同一列位，布局（grid/列宽/冻结偏移）仍按原始列位算。
  const resolvedAttributes = useMemo(
    () => resolveStageOverrides(attributes, allById, overrides),
    [attributes, allById, overrides],
  );

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
        className={`sticky left-0 z-1 flex min-w-0 items-center gap-1.5 pl-5.5 pr-2 text-[13px] text-(--fg) ${
          selected ? "bg-(--accent-selected)" : "bg-(--surface)"
        }`}
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{requirement.name}</span>
      </div>
      {resolvedAttributes.map((attribute, index) => {
        const frozen = index < frozenCount;
        // 覆盖只换内容属性，列位仍是原始列：冻结偏移查原始列位 id（attributes[index]），
        // 覆盖后 attribute.id 变成 to 属性 id，用它查 frozenOffsets 会拿不到偏移导致错位。
        const columnId = attributes[index]?.id ?? attribute.id;
        const visible = dependencySatisfied(attribute, requirement.attributeValues);
        const cell = visible ? (
          <FieldCell
            attribute={attribute}
            requirement={requirement}
            readOnly={isTerminal && attribute.id === "result"}
            onChange={(value) => onAttributeChange(attribute.id, value)}
          />
        ) : (
          // 依赖条件不满足：该格子为空，但列始终存在（讨论稿 §4.1 看板按行空白），
          // 空 div 保持 grid 列位对齐，不整列消失。
          <div className="min-h-4" aria-hidden="true" />
        );
        if (frozen) {
          // 冻结的属性列：外层包 sticky 定位的 div，背景跟随行的选中态，与 Name 列同款
          // 覆盖方式（滚动时遮住从下方滑过的非冻结列）。偏移由 frozenOffsetsFor 累加算出。
          // 只包冻结列，非冻结列保持原样直接渲染 cell，避免无关 DOM 结构变动。
          return (
            <div
              key={attribute.id}
              style={{ left: frozenOffsets[columnId] }}
              className={`sticky z-1 ${selected ? "bg-(--accent-selected)" : "bg-(--surface)"}`}
            >
              {cell}
            </div>
          );
        }
        return <div key={attribute.id}>{cell}</div>;
      })}
    </div>
  );
}

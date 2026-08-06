import { useMemo, useRef, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Attribute } from "../../types/schema";
import {
  BOARD_COLUMN_GAP,
  columnWidthFor,
  defaultColumnWidth,
  frozenOffsetsFor,
  gridTemplateColumnsFor,
} from "../../lib/boardWidth";
import { ColumnContextMenu } from "./ColumnContextMenu";

interface BoardHeaderProps {
  /** 已按 schema 可见属性顺序排好的属性列表（showOnBoard 过滤 + 排序在调用方完成）。 */
  attributes: Attribute[];
  /** 用户拖拽调整过的列宽（含拖拽中尚未持久化的实时值，见调用方 Board.tsx），键为属性 id。 */
  columnWidths: Record<string, number>;
  /** 冻结的属性列数（前 frozenCount 个属性列 sticky，Name 列恒冻结，见 REQ-001 MUST）。 */
  frozenCount: number;
  /** 右键表头"编辑此属性"跳转到设置页对应属性（见 REQ-025 设置页入口）。 */
  onEditAttribute: (attributeId: string) => void;
  /** 右键"隐藏此属性"：从看板隐藏该列（updateAttribute showOnBoard:false，视图偏好可逆）。 */
  onHideAttribute: (attributeId: string) => void;
  /** 右键"冻结至此列"：把冻结范围扩展到第 count 列（count = 目标列索引 + 1）。 */
  onFreezeTo: (count: number) => void;
  /** 拖拽过程中每次移动触发，只用于视觉实时反馈，不落盘（见 Board.tsx 的 draftColumnWidths）。 */
  onColumnWidthChange: (attributeId: string, width: number) => void;
  /** 松手时触发一次，调用方据此持久化（REQ-001 MUST"松手后持久化，重开应用保留"）。 */
  onColumnWidthCommit: (attributeId: string, width: number) => void;
  /** 拖拽表头文字换位松手后触发一次，携带完整的新顺序（REQ-001 MUST"松手后列位变化持久化"）。 */
  onReorder: (orderedIds: string[]) => void;
}

interface DragState {
  attributeId: string;
  startX: number;
  startWidth: number;
  lastWidth: number;
}

interface HeaderCellProps {
  attribute: Attribute;
  /** 该列是否在冻结范围内：冻结时用 position:sticky 替代 relative，横向滚动时钉住。 */
  frozen: boolean;
  /** 冻结列的 sticky left 偏移（px），由 frozenOffsetsFor 按列宽累加算出。 */
  leftOffset: number | undefined;
  onContextMenu: (e: React.MouseEvent, attributeId: string) => void;
  onResizePointerDown: (e: React.PointerEvent<HTMLDivElement>, attribute: Attribute) => void;
  onResizePointerMove: (e: React.PointerEvent<HTMLDivElement>, attribute: Attribute) => void;
  onResizePointerUp: (e: React.PointerEvent<HTMLDivElement>, attribute: Attribute) => void;
}

/**
 * 单个属性列表头：文字部分是拖拽把手（REQ-001 MUST"拖表头...调序"），右边缘另有
 * 一个独立的调宽手柄（Task 2）。调宽手柄的 pointerdown 要 stopPropagation，否则
 * 事件冒泡到外层会被 useSortable 的 listeners 一起当成拖拽调序的起手。
 * 冻结列表头必须显式 z-index：表头所有单元格都是定位元素（非冻结是 relative），
 * 没有 z-index 时按 DOM 顺序绘制，靠后的非冻结列会盖到冻结列上。
 */
function HeaderCell({
  attribute,
  frozen,
  leftOffset,
  onContextMenu,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
}: HeaderCellProps) {
  const { attributes: sortableAttributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: attribute.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...sortableAttributes}
      onContextMenu={(e) => onContextMenu(e, attribute.id)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(frozen ? { left: leftOffset, position: "sticky" as const } : {}),
      }}
      className={`${frozen ? "sticky z-1 bg-(--surface)" : "relative"} cursor-grab text-center font-(family-name:--font-mono) ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {attribute.name}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`调整「${attribute.name}」列宽`}
        onPointerDown={(e) => {
          e.stopPropagation();
          onResizePointerDown(e, attribute);
        }}
        onPointerMove={(e) => onResizePointerMove(e, attribute)}
        onPointerUp={(e) => onResizePointerUp(e, attribute)}
        className="absolute top-0 -right-1.5 h-full w-3 cursor-col-resize"
      />
    </div>
  );
}

/** 看板表头：Name 列固定最左 sticky，其余列从 schema 可见属性动态生成，可拖拽调宽/调序/冻结。 */
export function BoardHeader({
  attributes,
  columnWidths,
  frozenCount,
  onEditAttribute,
  onHideAttribute,
  onFreezeTo,
  onColumnWidthChange,
  onColumnWidthCommit,
  onReorder,
}: BoardHeaderProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [contextMenu, setContextMenu] = useState<{ attributeId: string; x: number; y: number } | null>(null);
  // 用 ref 而不是 state 记录拖拽中的起点/最新宽度：拖拽期间的实时宽度已经通过
  // onColumnWidthChange 上抛给 Board.tsx 的 draftColumnWidths 驱动重渲染，这里只需要
  // 在 pointerup 时拿到"刚才移动到的最终宽度"用于提交，不需要再触发一次自身重渲染。
  const dragRef = useRef<DragState | null>(null);

  const frozenOffsets = useMemo(
    () => frozenOffsetsFor(attributes, columnWidths, frozenCount),
    [attributes, columnWidths, frozenCount],
  );

  // 右键菜单所属列在可见列里的索引，配合 frozenCount 判断"冻结至此列"是否显示：
  // frozenCount === 索引 表示左侧列已全部冻结、本列恰是下一个待冻结的列（讨论稿 §8.2）。
  // 已冻结列（索引 < frozenCount）和左侧未冻结完的列都不显示。
  const menuIndex = contextMenu ? attributes.findIndex((a) => a.id === contextMenu.attributeId) : -1;
  const canFreeze = menuIndex !== -1 && frozenCount === menuIndex;

  function handleContextMenu(e: React.MouseEvent, attributeId: string) {
    e.preventDefault();
    setContextMenu({ attributeId, x: e.clientX, y: e.clientY });
  }

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>, attribute: Attribute) {
    const startWidth = columnWidthFor(attribute, columnWidths);
    dragRef.current = { attributeId: attribute.id, startX: e.clientX, startWidth, lastWidth: startWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleResizePointerMove(e: React.PointerEvent<HTMLDivElement>, attribute: Attribute) {
    const drag = dragRef.current;
    if (!drag || drag.attributeId !== attribute.id) return;
    const deltaX = e.clientX - drag.startX;
    const next = Math.max(defaultColumnWidth(attribute), drag.startWidth + deltaX);
    drag.lastWidth = next;
    onColumnWidthChange(attribute.id, next);
  }

  function handleResizePointerUp(e: React.PointerEvent<HTMLDivElement>, attribute: Attribute) {
    const drag = dragRef.current;
    if (!drag || drag.attributeId !== attribute.id) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    onColumnWidthCommit(attribute.id, drag.lastWidth);
  }

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

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className="sticky top-0 z-4 grid h-(--board-header-h) w-fit min-w-full items-center bg-(--surface) px-2 text-[11.5px] tracking-[0.02em] text-(--muted)"
        style={{ gridTemplateColumns: gridTemplateColumnsFor(attributes, columnWidths), columnGap: BOARD_COLUMN_GAP }}
      >
        <div className="sticky left-0 z-1 bg-(--surface) pl-5.5 pr-2 font-(family-name:--font-body) font-[550]">名称</div>
        <SortableContext items={attributes.map((a) => a.id)} strategy={horizontalListSortingStrategy}>
          {attributes.map((a, index) => (
            <HeaderCell
              key={a.id}
              attribute={a}
              frozen={index < frozenCount}
              leftOffset={frozenOffsets[a.id]}
              onContextMenu={handleContextMenu}
              onResizePointerDown={handleResizePointerDown}
              onResizePointerMove={handleResizePointerMove}
              onResizePointerUp={handleResizePointerUp}
            />
          ))}
        </SortableContext>

        {contextMenu && (
          <ColumnContextMenu
            position={{ x: contextMenu.x, y: contextMenu.y }}
            canFreeze={canFreeze}
            onHide={() => {
              onHideAttribute(contextMenu.attributeId);
              setContextMenu(null);
            }}
            onFreeze={() => {
              onFreezeTo(menuIndex + 1);
              setContextMenu(null);
            }}
            onEdit={() => {
              onEditAttribute(contextMenu.attributeId);
              setContextMenu(null);
            }}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </DndContext>
  );
}

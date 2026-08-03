import { useRef, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Attribute } from "../../types/schema";
import { columnWidthFor, defaultColumnWidth, gridTemplateColumnsFor } from "../../lib/boardWidth";
import { ColumnContextMenu } from "./ColumnContextMenu";

interface BoardHeaderProps {
  /** 已按 schema 可见属性顺序排好的属性列表（showOnBoard 过滤 + 排序在调用方完成）。 */
  attributes: Attribute[];
  /** 用户拖拽调整过的列宽（含拖拽中尚未持久化的实时值，见调用方 Board.tsx），键为属性 id。 */
  columnWidths: Record<string, number>;
  /** 右键表头"编辑此属性"跳转到设置页对应属性（见 REQ-025 设置页入口）。 */
  onEditAttribute: (attributeId: string) => void;
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
  onContextMenu: (e: React.MouseEvent, attributeId: string) => void;
  onResizePointerDown: (e: React.PointerEvent<HTMLDivElement>, attribute: Attribute) => void;
  onResizePointerMove: (e: React.PointerEvent<HTMLDivElement>, attribute: Attribute) => void;
  onResizePointerUp: (e: React.PointerEvent<HTMLDivElement>, attribute: Attribute) => void;
}

/**
 * 单个属性列表头：文字部分是拖拽把手（REQ-001 MUST"拖表头...调序"），右边缘另有
 * 一个独立的调宽手柄（Task 2）。调宽手柄的 pointerdown 要 stopPropagation，否则
 * 事件冒泡到外层会被 useSortable 的 listeners 一起当成拖拽调序的起手。
 */
function HeaderCell({ attribute, onContextMenu, onResizePointerDown, onResizePointerMove, onResizePointerUp }: HeaderCellProps) {
  const { attributes: sortableAttributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: attribute.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...sortableAttributes}
      onContextMenu={(e) => onContextMenu(e, attribute.id)}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative cursor-grab text-center font-(family-name:--font-mono) ${isDragging ? "opacity-40" : ""}`}
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

/** 看板表头：Name 列固定最左 sticky，其余列从 schema 可见属性动态生成，可拖拽调宽/调序。 */
export function BoardHeader({
  attributes,
  columnWidths,
  onEditAttribute,
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
        className="sticky top-0 z-4 grid h-(--board-header-h) w-fit min-w-full items-center gap-3 bg-(--surface) px-2 text-[11.5px] tracking-[0.02em] text-(--muted)"
        style={{ gridTemplateColumns: gridTemplateColumnsFor(attributes, columnWidths) }}
      >
        <div className="sticky left-0 bg-(--surface) pr-2 font-(family-name:--font-body) font-[550]">名称</div>
        <SortableContext items={attributes.map((a) => a.id)} strategy={horizontalListSortingStrategy}>
          {attributes.map((a) => (
            <HeaderCell
              key={a.id}
              attribute={a}
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

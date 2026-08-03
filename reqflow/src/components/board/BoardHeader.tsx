import { useRef, useState } from "react";
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
}

interface DragState {
  attributeId: string;
  startX: number;
  startWidth: number;
  lastWidth: number;
}

/** 看板表头：Name 列固定最左 sticky，其余列从 schema 可见属性动态生成，右边缘可拖拽调宽。 */
export function BoardHeader({
  attributes,
  columnWidths,
  onEditAttribute,
  onColumnWidthChange,
  onColumnWidthCommit,
}: BoardHeaderProps) {
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

  return (
    <div
      className="sticky top-0 z-4 grid h-(--board-header-h) w-fit min-w-full items-center gap-3 bg-(--surface) px-2 text-[11.5px] tracking-[0.02em] text-(--muted)"
      style={{ gridTemplateColumns: gridTemplateColumnsFor(attributes, columnWidths) }}
    >
      <div className="sticky left-0 bg-(--surface) pr-2 font-(family-name:--font-body) font-[550]">名称</div>
      {attributes.map((a) => (
        <div
          key={a.id}
          onContextMenu={(e) => handleContextMenu(e, a.id)}
          className="relative text-center font-(family-name:--font-mono)"
        >
          {a.name}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={`调整「${a.name}」列宽`}
            onPointerDown={(e) => handleResizePointerDown(e, a)}
            onPointerMove={(e) => handleResizePointerMove(e, a)}
            onPointerUp={(e) => handleResizePointerUp(e, a)}
            className="absolute top-0 -right-1.5 h-full w-3 cursor-col-resize"
          />
        </div>
      ))}

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
  );
}

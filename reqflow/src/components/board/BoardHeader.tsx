import { useState } from "react";
import type { Attribute } from "../../types/schema";
import { gridTemplateColumnsFor } from "../../lib/boardWidth";
import { ColumnContextMenu } from "./ColumnContextMenu";

interface BoardHeaderProps {
  /** 已按 schema 可见属性顺序排好的属性列表（showOnBoard 过滤 + 排序在调用方完成）。 */
  attributes: Attribute[];
  /** 右键表头"编辑此属性"跳转到设置页对应属性（见 REQ-025 设置页入口）。 */
  onEditAttribute: (attributeId: string) => void;
}

/** 看板表头：Name 列固定最左 sticky，其余列从 schema 可见属性动态生成。 */
export function BoardHeader({ attributes, onEditAttribute }: BoardHeaderProps) {
  const [contextMenu, setContextMenu] = useState<{ attributeId: string; x: number; y: number } | null>(null);

  function handleContextMenu(e: React.MouseEvent, attributeId: string) {
    e.preventDefault();
    setContextMenu({ attributeId, x: e.clientX, y: e.clientY });
  }

  return (
    <div
      className="sticky top-0 z-4 grid h-(--board-header-h) w-fit min-w-full items-center gap-3 bg-(--surface) px-2 text-[11.5px] tracking-[0.02em] text-(--muted)"
      style={{ gridTemplateColumns: gridTemplateColumnsFor(attributes) }}
    >
      <div className="sticky left-0 bg-(--surface) pr-2 font-(family-name:--font-body) font-[550]">名称</div>
      {attributes.map((a) => (
        <div
          key={a.id}
          onContextMenu={(e) => handleContextMenu(e, a.id)}
          className="text-center font-(family-name:--font-mono)"
        >
          {a.name}
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

import type { Attribute } from "../../types/schema";
import { gridTemplateColumnsFor } from "../../lib/boardWidth";

interface BoardHeaderProps {
  /** 已按 schema 可见属性顺序排好的属性列表（showOnBoard 过滤 + 排序在调用方完成）。 */
  attributes: Attribute[];
}

/** 看板表头：Name 列固定最左 sticky，其余列从 schema 可见属性动态生成。 */
export function BoardHeader({ attributes }: BoardHeaderProps) {
  return (
    <div
      className="sticky top-0 z-4 grid h-(--board-header-h) w-fit min-w-full items-center gap-3 bg-(--surface) px-2 text-[11.5px] tracking-[0.02em] text-(--muted)"
      style={{ gridTemplateColumns: gridTemplateColumnsFor(attributes) }}
    >
      <div className="sticky left-0 bg-(--surface) pr-2 font-(family-name:--font-body) font-[550]">名称</div>
      {attributes.map((a) => (
        <div key={a.id} className="text-center font-(family-name:--font-mono)">
          {a.name}
        </div>
      ))}
    </div>
  );
}

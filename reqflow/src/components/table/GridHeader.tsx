import type { ColumnLayout } from "../../lib/table/columnLayout";
import { useState, type PointerEvent as ReactPointerEvent } from "react";

interface GridHeaderProps { layouts: ColumnLayout[]; groupNames: Record<string, string>; rowHeight: number; collapsedGroupIds: string[]; onToggleGroup: (groupId: string) => void; onReorderGroup: (sourceId: string, targetId: string) => void; onResize: (fieldId: string, width: number) => void; onAutoFit: (fieldId: string) => void; onFreezeTo: (fieldId: string) => void; onClearExtraFreeze: () => void; }

export function GridHeader({ layouts, groupNames, rowHeight, collapsedGroupIds, onToggleGroup, onReorderGroup, onResize, onAutoFit, onFreezeTo, onClearExtraFreeze }: GridHeaderProps) {
  const groups = groupSegments(layouts);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  return <div className="morfra-grid-header" style={{ gridTemplateColumns: gridTemplate(layouts) }}>
    <div className="morfra-grid-row-number morfra-grid-sticky">#</div>
    {groups.map((group) => <div key={group.key} className={`morfra-grid-group ${group.frozen ? "is-frozen" : ""}`} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggedGroupId(group.id); }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedGroupId && draggedGroupId !== group.id) onReorderGroup(draggedGroupId, group.id); setDraggedGroupId(null); }} style={{ gridColumn: `${group.start + 2} / span ${group.count}`, ...(group.frozen ? { left: `var(--grid-sticky-${group.firstFieldId})` } : {}) }}>{group.groupId ? <button type="button" onClick={() => onToggleGroup(group.groupId!)}>{collapsedGroupIds.includes(group.groupId) ? "›" : "⌄"} {groupNames[group.groupId] ?? "字段组"}</button> : "未分组"}</div>)}
    {layouts.map((layout) => <GridHeaderCell key={layout.field.id} layout={layout} rowHeight={rowHeight} onResize={onResize} onAutoFit={onAutoFit} onFreezeTo={onFreezeTo} onClearExtraFreeze={onClearExtraFreeze} />)}
  </div>;
}

function GridHeaderCell({ layout, rowHeight, onResize, onAutoFit, onFreezeTo, onClearExtraFreeze }: { layout: ColumnLayout; rowHeight: number; onResize: GridHeaderProps["onResize"]; onAutoFit: GridHeaderProps["onAutoFit"]; onFreezeTo: GridHeaderProps["onFreezeTo"]; onClearExtraFreeze: GridHeaderProps["onClearExtraFreeze"]; }) {
  const [menuOpen, setMenuOpen] = useState(false);
  function resize(event: ReactPointerEvent<HTMLButtonElement>) { const startX = event.clientX; const startWidth = layout.width; const move = (next: PointerEvent) => onResize(layout.field.id, startWidth + next.clientX - startX); const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); }
  return <div className={`morfra-grid-column-header ${layout.frozen ? "is-frozen" : ""} ${layout.field.isTitle ? "is-title" : ""}`} style={{ minHeight: rowHeight, ...(layout.frozen ? { left: `var(--grid-sticky-${layout.field.id})` } : {}) }}>
    <span title={layout.field.name}>{layout.field.name}</span><small>{layout.field.fieldType}</small>
    <button type="button" className="morfra-grid-freeze" aria-label={`打开 ${layout.field.name} 字段菜单`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>⋯</button>
    {menuOpen && <div className="morfra-grid-header-menu" role="menu"><button type="button" role="menuitem" onClick={() => { onFreezeTo(layout.field.id); setMenuOpen(false); }}>冻结至此列</button><button type="button" role="menuitem" disabled={layout.field.isTitle} onClick={() => { onClearExtraFreeze(); setMenuOpen(false); }}>取消额外冻结</button></div>}
    <button type="button" className="morfra-grid-resize" aria-label={`调整 ${layout.field.name} 列宽`} onPointerDown={resize} onDoubleClick={() => onAutoFit(layout.field.id)} />
  </div>;
}

function groupSegments(layouts: ColumnLayout[]) { const result: { id: string; key: string; groupId: string | null; name: string; start: number; count: number; frozen: boolean; firstFieldId: string }[] = []; for (let index = 0; index < layouts.length;) { const field = layouts[index].field; if (field.isTitle) { index += 1; continue; } const id = field.groupId ?? "ungrouped"; const frozen = layouts[index].frozen; let end = index + 1; while (end < layouts.length && !layouts[end].field.isTitle && (layouts[end].field.groupId ?? "ungrouped") === id && layouts[end].frozen === frozen) end += 1; result.push({ id, key: `${id}-${frozen ? "frozen" : "scroll"}-${index}`, groupId: field.groupId, name: field.groupId ? "字段组" : "未分组", start: index, count: end - index, frozen, firstFieldId: field.id }); index = end; } return result; }
function gridTemplate(layouts: ColumnLayout[]) { return `68px ${layouts.map((layout) => `${layout.width}px`).join(" ")}`; }

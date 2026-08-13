import { ROW_NUMBER_WIDTH, type ColumnLayout } from "../../lib/table/columnLayout";
import type { FieldType } from "../../types/domain";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FieldTypePicker } from "../fields/FieldTypePicker";

interface GridHeaderProps { layouts: ColumnLayout[]; groupNames: Record<string, string>; rowHeight: number; collapsedGroupIds: string[]; onCreateField?: (fieldType: FieldType, name: string) => Promise<string>; onRenameField?: (fieldId: string, name: string) => Promise<void>; onToggleGroup: (groupId: string) => void; onReorderGroup: (sourceId: string, targetId: string) => void; onResize: (fieldId: string, width: number) => void; onAutoFit: (fieldId: string) => void; onFreezeTo: (fieldId: string) => void; onClearExtraFreeze: () => void; }

const FIELD_TYPE_ICONS: Record<FieldType, string> = { text: "T", number: "#", select: "⌄", multi_select: "≡", date: "◷", checkbox: "☑", progress: "%", link: "↗", image: "▧", file: "▤", auto_number: "#", created_time: "◷", updated_time: "◷" };
const FIELD_TYPE_LABELS: Record<FieldType, string> = { text: "文本", number: "数字", select: "单选", multi_select: "多选", date: "日期", checkbox: "复选框", progress: "进度", link: "链接", image: "图片", file: "文件", auto_number: "自动编号", created_time: "创建时间", updated_time: "最后编辑时间" };

export function GridHeader({ layouts, groupNames, rowHeight, collapsedGroupIds, onCreateField, onRenameField, onToggleGroup, onReorderGroup, onResize, onAutoFit, onFreezeTo, onClearExtraFreeze }: GridHeaderProps) {
  const groups = groupSegments(layouts);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [createdFieldId, setCreatedFieldId] = useState<string | null>(null);
  return <div className="morfra-grid-header" style={{ gridTemplateColumns: gridTemplate(layouts, Boolean(onCreateField)) }}>
    <div className="morfra-grid-row-number morfra-grid-sticky">#</div>
    {groups.map((group) => <div key={group.key} className={`morfra-grid-group ${group.frozen ? "is-frozen" : ""}`} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggedGroupId(group.id); }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedGroupId && draggedGroupId !== group.id) onReorderGroup(draggedGroupId, group.id); setDraggedGroupId(null); }} style={{ gridColumn: `${group.start + 2} / span ${group.count}`, ...(group.frozen ? { left: `var(--grid-sticky-${group.firstFieldId})` } : {}) }}>{group.groupId ? <button type="button" onClick={() => onToggleGroup(group.groupId!)}>{collapsedGroupIds.includes(group.groupId) ? "›" : "⌄"} {groupNames[group.groupId] ?? "字段组"}</button> : "未分组"}</div>)}
    {layouts.map((layout) => <GridHeaderCell key={layout.field.id} layout={layout} rowHeight={rowHeight} autoEdit={layout.field.id === createdFieldId} onAutoEditEnd={() => setCreatedFieldId(null)} onRename={onRenameField} onResize={onResize} onAutoFit={onAutoFit} onFreezeTo={onFreezeTo} onClearExtraFreeze={onClearExtraFreeze} />)}
    {onCreateField && <QuickAddField onCreate={onCreateField} onCreated={setCreatedFieldId} />}
  </div>;
}

function GridHeaderCell({ layout, rowHeight, autoEdit, onAutoEditEnd, onRename, onResize, onAutoFit, onFreezeTo, onClearExtraFreeze }: { layout: ColumnLayout; rowHeight: number; autoEdit: boolean; onAutoEditEnd: () => void; onRename?: GridHeaderProps["onRenameField"]; onResize: GridHeaderProps["onResize"]; onAutoFit: GridHeaderProps["onAutoFit"]; onFreezeTo: GridHeaderProps["onFreezeTo"]; onClearExtraFreeze: GridHeaderProps["onClearExtraFreeze"]; }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(layout.field.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancellingRef = useRef(false);
  const savingRef = useRef(false);
  useEffect(() => { if (!autoEdit) return; setName(layout.field.name); requestAnimationFrame(() => { inputRef.current?.select(); inputRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" }); }); }, [autoEdit, layout.field.name]);
  async function commitName() { if (!autoEdit || cancellingRef.current || savingRef.current) return; const nextName = name.trim(); if (!nextName) { setName(layout.field.name); return; } try { savingRef.current = true; setRenameError(null); await onRename?.(layout.field.id, nextName); onAutoEditEnd(); } catch (error) { setRenameError(error instanceof Error ? error.message : "字段重命名失败，请重试"); } finally { savingRef.current = false; } }
  function resize(event: ReactPointerEvent<HTMLButtonElement>) { const startX = event.clientX; const startWidth = layout.width; const move = (next: PointerEvent) => onResize(layout.field.id, startWidth + next.clientX - startX); const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); }
  return <div className={`morfra-grid-column-header ${layout.frozen ? "is-frozen" : ""} ${layout.field.isTitle ? "is-title" : ""}`} style={{ minHeight: rowHeight, ...(layout.frozen ? { left: `var(--grid-sticky-${layout.field.id})` } : {}) }}>
    <span className="morfra-grid-field-type-icon" aria-hidden="true">{FIELD_TYPE_ICONS[layout.field.fieldType]}</span>{autoEdit ? <input ref={inputRef} aria-label={`重命名字段 ${layout.field.name}`} className="morfra-grid-field-name-input" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => void commitName()} onKeyDown={(event) => { if (event.key === "Enter") void commitName(); if (event.key === "Escape") { cancellingRef.current = true; setName(layout.field.name); onAutoEditEnd(); } }} /> : <span title={layout.field.name}>{layout.field.name}</span>}
    <button type="button" className="morfra-grid-freeze" aria-label={`打开 ${layout.field.name} 字段菜单`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>⋯</button>
    {menuOpen && <div className="morfra-grid-header-menu" role="menu"><span className="morfra-grid-field-type-label">类型：{FIELD_TYPE_LABELS[layout.field.fieldType]}</span><button type="button" role="menuitem" onClick={() => { onFreezeTo(layout.field.id); setMenuOpen(false); }}>冻结至此列</button><button type="button" role="menuitem" disabled={layout.field.isTitle} onClick={() => { onClearExtraFreeze(); setMenuOpen(false); }}>取消额外冻结</button></div>}
    {renameError && <span className="morfra-grid-header-error" role="alert">{renameError}</span>}<button type="button" className="morfra-grid-resize" aria-label={`调整 ${layout.field.name} 列宽`} onPointerDown={resize} onDoubleClick={() => onAutoFit(layout.field.id)} />
  </div>;
}

function QuickAddField({ onCreate, onCreated }: { onCreate: (fieldType: FieldType, name: string) => Promise<string>; onCreated: (fieldId: string) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="morfra-grid-add-field-header">
    {open ? <FieldTypePicker onCreate={async (fieldType, name) => { const fieldId = await onCreate(fieldType, name); onCreated(fieldId); setOpen(false); }} onClose={() => setOpen(false)} /> : <button type="button" onClick={() => setOpen(true)}>＋ 添加字段</button>}
  </div>;
}

function groupSegments(layouts: ColumnLayout[]) { const result: { id: string; key: string; groupId: string | null; name: string; start: number; count: number; frozen: boolean; firstFieldId: string }[] = []; for (let index = 0; index < layouts.length;) { const field = layouts[index].field; if (field.isTitle) { index += 1; continue; } const id = field.groupId ?? "ungrouped"; const frozen = layouts[index].frozen; let end = index + 1; while (end < layouts.length && !layouts[end].field.isTitle && (layouts[end].field.groupId ?? "ungrouped") === id && layouts[end].frozen === frozen) end += 1; result.push({ id, key: `${id}-${frozen ? "frozen" : "scroll"}-${index}`, groupId: field.groupId, name: field.groupId ? "字段组" : "未分组", start: index, count: end - index, frozen, firstFieldId: field.id }); index = end; } return result; }
function gridTemplate(layouts: ColumnLayout[], includeAddField: boolean) { return `${ROW_NUMBER_WIDTH}px ${layouts.map((layout) => `${layout.width}px`).join(" ")}${includeAddField ? " 112px" : ""}`; }

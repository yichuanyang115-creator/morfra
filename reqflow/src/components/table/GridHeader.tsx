import { ADD_FIELD_COLUMN_WIDTH, ROW_NUMBER_WIDTH, type ColumnLayout } from "../../lib/table/columnLayout";
import type { FieldType } from "../../types/domain";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FieldTypePicker } from "../fields/FieldTypePicker";
import { FIELD_TYPE_LABELS, FieldTypeIcon } from "../fields/FieldTypeIcon";

interface GridHeaderProps { layouts: ColumnLayout[]; rowHeight: number; frozenBoundaryFieldId?: string; onCreateField?: (fieldType: FieldType, name: string) => Promise<string>; onRenameField?: (fieldId: string, name: string) => Promise<void>; onResize: (fieldId: string, width: number) => void; onAutoFit: (fieldId: string) => void; onFreezeTo: (fieldId: string) => void; onClearExtraFreeze: () => void; }


export function GridHeader({ layouts, rowHeight, frozenBoundaryFieldId, onCreateField, onRenameField, onResize, onAutoFit, onFreezeTo, onClearExtraFreeze }: GridHeaderProps) {
  const [createdFieldId, setCreatedFieldId] = useState<string | null>(null);
  return <div className="morfra-grid-header" style={{ gridTemplateColumns: gridTemplate(layouts, Boolean(onCreateField)) }}>
    <div className="morfra-grid-row-number morfra-grid-sticky">#</div>
    {layouts.map((layout) => <GridHeaderCell key={layout.field.id} layout={layout} frozenBoundary={layout.field.id === frozenBoundaryFieldId} rowHeight={rowHeight} autoEdit={layout.field.id === createdFieldId} onAutoEditEnd={() => setCreatedFieldId(null)} onRename={onRenameField} onResize={onResize} onAutoFit={onAutoFit} onFreezeTo={onFreezeTo} onClearExtraFreeze={onClearExtraFreeze} />)}
    {onCreateField && <QuickAddField onCreate={onCreateField} onCreated={setCreatedFieldId} />}
  </div>;
}

function GridHeaderCell({ layout, frozenBoundary, rowHeight, autoEdit, onAutoEditEnd, onRename, onResize, onAutoFit, onFreezeTo, onClearExtraFreeze }: { layout: ColumnLayout; frozenBoundary: boolean; rowHeight: number; autoEdit: boolean; onAutoEditEnd: () => void; onRename?: GridHeaderProps["onRenameField"]; onResize: GridHeaderProps["onResize"]; onAutoFit: GridHeaderProps["onAutoFit"]; onFreezeTo: GridHeaderProps["onFreezeTo"]; onClearExtraFreeze: GridHeaderProps["onClearExtraFreeze"]; }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(layout.field.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRootRef = useRef<HTMLDivElement>(null);
  const cancellingRef = useRef(false);
  const savingRef = useRef(false);
  useEffect(() => { if (!autoEdit) return; setName(layout.field.name); requestAnimationFrame(() => { inputRef.current?.select(); inputRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" }); }); }, [autoEdit, layout.field.name]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnPointerOutside = (event: PointerEvent) => {
      if (!menuRootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerOutside);
    return () => document.removeEventListener("pointerdown", closeOnPointerOutside);
  }, [menuOpen]);
  async function commitName() { if (!autoEdit || cancellingRef.current || savingRef.current) return; const nextName = name.trim(); if (!nextName) { setName(layout.field.name); return; } try { savingRef.current = true; setRenameError(null); await onRename?.(layout.field.id, nextName); onAutoEditEnd(); } catch (error) { setRenameError(error instanceof Error ? error.message : "字段重命名失败，请重试"); } finally { savingRef.current = false; } }
  function resize(event: ReactPointerEvent<HTMLButtonElement>) { const startX = event.clientX; const startWidth = layout.width; const move = (next: PointerEvent) => onResize(layout.field.id, startWidth + next.clientX - startX); const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); }
  return <div ref={menuRootRef} className={`morfra-grid-column-header ${layout.frozen ? "is-frozen" : ""} ${frozenBoundary ? "is-frozen-edge" : ""} ${layout.field.isTitle ? "is-title" : ""}`} style={{ minHeight: rowHeight, ...(layout.frozen ? { left: `var(--grid-sticky-${layout.field.id})` } : {}) }} onBlur={(event) => { const nextTarget = event.relatedTarget; if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setMenuOpen(false); }}>
    <span className="morfra-grid-field-type-icon" aria-hidden="true"><FieldTypeIcon type={layout.field.fieldType} /></span>{autoEdit ? <input ref={inputRef} aria-label={`重命名字段 ${layout.field.name}`} className="morfra-grid-field-name-input" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => void commitName()} onKeyDown={(event) => { if (event.key === "Enter") void commitName(); if (event.key === "Escape") { cancellingRef.current = true; setName(layout.field.name); onAutoEditEnd(); } }} /> : <span title={layout.field.name}>{layout.field.name}</span>}
    <button type="button" className="morfra-grid-freeze" aria-label={`打开 ${layout.field.name} 字段菜单`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>⋯</button>
    {menuOpen && <div className="morfra-grid-header-menu" role="menu"><span className="morfra-grid-field-type-label">类型：{FIELD_TYPE_LABELS[layout.field.fieldType]}</span><button type="button" role="menuitem" onClick={() => { onFreezeTo(layout.field.id); setMenuOpen(false); }}>冻结至此列</button><button type="button" role="menuitem" disabled={layout.field.isTitle} onClick={() => { onClearExtraFreeze(); setMenuOpen(false); }}>取消额外冻结</button></div>}
    {renameError && <span className="morfra-grid-header-error" role="alert">{renameError}</span>}<button type="button" className="morfra-grid-resize" aria-label={`调整 ${layout.field.name} 列宽`} onPointerDown={resize} onDoubleClick={() => onAutoFit(layout.field.id)} />
  </div>;
}

function QuickAddField({ onCreate, onCreated }: { onCreate: (fieldType: FieldType, name: string) => Promise<string>; onCreated: (fieldId: string) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  function closePicker() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }
  return <div className="morfra-grid-add-field-header">
    <button ref={triggerRef} type="button" className="morfra-grid-add-field-trigger" aria-label="添加字段" aria-expanded={open} onClick={() => setOpen(true)}>＋</button>
    {open && <FieldTypePicker onCreate={async (fieldType, name) => { const fieldId = await onCreate(fieldType, name); onCreated(fieldId); setOpen(false); }} onClose={closePicker} />}
  </div>;
}

function gridTemplate(layouts: ColumnLayout[], includeAddField: boolean) { return `${ROW_NUMBER_WIDTH}px ${layouts.map((layout) => `${layout.width}px`).join(" ")}${includeAddField ? ` ${ADD_FIELD_COLUMN_WIDTH}px` : ""}`; }

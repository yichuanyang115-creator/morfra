import { useRef, useState, type DragEvent } from "react";
import type { FieldSummary } from "../../types/domain";
import { FIELD_TYPE_LABELS, FieldTypeIcon } from "./FieldTypeIcon";

export { FIELD_TYPE_LABELS } from "./FieldTypeIcon";

interface FieldEditorProps {
  field: FieldSummary;
  visible: boolean;
  onEdit: (field: FieldSummary) => void;
  onRename: (field: FieldSummary, name: string) => Promise<void>;
  onDelete: (field: FieldSummary, restoreFocus: () => void) => void;
  onViewMove: (fieldId: string, delta: -1 | 1) => void;
  onVisibilityChange: () => void;
  onDragStart: (fieldId: string) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (fieldId: string) => void;
}

export function FieldEditor({ field, visible, onEdit, onRename, onDelete, onViewMove, onVisibilityChange, onDragStart, onDragOver, onDrop }: FieldEditorProps) {
  const [renaming, setRenaming] = useState(false); const [name, setName] = useState(field.name); const input = useRef<HTMLInputElement>(null);
  const commit = async () => { const next = name.trim(); if (!next || next === field.name) { setName(field.name); setRenaming(false); return; } await onRename(field, next); setRenaming(false); };
  return <article draggable={!field.isTitle} tabIndex={0} onKeyDown={(event) => { if (!field.isTitle && event.altKey && event.key === "ArrowUp") { event.preventDefault(); onViewMove(field.id, -1); } if (!field.isTitle && event.altKey && event.key === "ArrowDown") { event.preventDefault(); onViewMove(field.id, 1); } }} onDragStart={() => onDragStart(field.id)} onDragOver={onDragOver} onDrop={() => onDrop(field.id)} className={`flex min-h-9 items-center gap-2 border-b border-(--module-scope-border-subtle) px-3 py-1.5 last:border-b-0${!visible && !field.isTitle ? " opacity-70" : ""}`}>
    <span className="grid size-5 shrink-0 place-items-center text-(--module-scope-text-secondary)" title={FIELD_TYPE_LABELS[field.fieldType]} aria-hidden="true"><FieldTypeIcon type={field.fieldType} /></span>
    <div className="min-w-0 flex-1">{renaming ? <input ref={input} aria-label={`重命名字段 ${field.name}`} className="morfra-field-rename-input w-full rounded-(--r-sm) border border-(--module-scope-border-subtle) px-1 text-[12px] outline-none focus:border-(--module-scope-action-base)" value={name} autoFocus onChange={(event) => setName(event.target.value)} onBlur={() => void commit()} onKeyDown={(event) => { if (event.key === "Enter") void commit(); if (event.key === "Escape") { setName(field.name); setRenaming(false); } }} /> : <button type="button" className="w-full truncate text-left text-[12px] text-(--module-scope-text-primary)" onClick={() => { setName(field.name); setRenaming(true); }}>{field.name}</button>}</div>
    <button type="button" aria-label={field.isTitle ? "主标题始终显示" : visible ? `隐藏 ${field.name}` : `显示 ${field.name}`} disabled={field.isTitle} className="rounded-(--r-sm) p-1 text-[11px] disabled:opacity-50" onClick={onVisibilityChange}><EyeIcon hidden={!visible && !field.isTitle} /></button>
    <button data-field-edit-id={field.id} type="button" aria-label={`编辑字段 ${field.name}`} title="编辑字段" className="rounded-(--r-sm) border border-(--module-scope-border-subtle) px-1.5 py-1 text-[11px]" onClick={() => onEdit(field)}>编辑</button>
    {!field.isTitle && <button type="button" aria-label={`删除字段 ${field.name}`} title="删除字段" className="rounded-(--r-sm) p-1 text-(--module-scope-feedback-danger)" onClick={(event) => onDelete(field, () => (event.currentTarget as HTMLButtonElement).focus())}><TrashIcon /></button>}
  </article>;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 3 18 18" /><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c5.4 0 9.2 4.3 10 6-.4.9-1.4 2.4-3 3.7M6.2 6.2C3.9 7.7 2.5 10 2 12c.8 1.7 4.6 6 10 6 1 0 2-.2 2.9-.6" /><circle cx="12" cy="12" r="3" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function TrashIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
}

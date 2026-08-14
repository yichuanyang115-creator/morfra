import { useEffect, useRef, useState, type DragEvent } from "react";
import type { FieldOptionSummary, FieldSummary, FieldType, JsonValue } from "../../types/domain";
import { OptionEditor } from "./OptionEditor";
import { FIELD_TYPE_LABELS, FieldTypeIcon } from "./FieldTypeIcon";

export { FIELD_TYPE_LABELS } from "./FieldTypeIcon";

interface FieldEditorProps {
  field: FieldSummary;
  onSave: (field: FieldSummary, nextName: string, nextType: FieldType, config: JsonValue) => Promise<void>;
  onDelete: (field: FieldSummary) => void;
  onCreateOption: (fieldId: string, name: string, color?: string) => Promise<void>;
  onUpdateOption: (option: FieldOptionSummary, name: string, color: string) => Promise<void>;
  onDeleteOption: (option: FieldOptionSummary) => Promise<void>;
  onReorderOption: (fieldId: string, optionIds: string[]) => Promise<void>;
  onViewMove: (fieldId: string, delta: -1 | 1) => void;
  onVisibilityChange: () => void;
  visible: boolean;
  onDragStart: (fieldId: string) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (fieldId: string) => void;
  autoEdit?: boolean;
}

export function FieldEditor({ field, onSave, onDelete, onCreateOption, onUpdateOption, onDeleteOption, onReorderOption, onViewMove, onVisibilityChange, visible, onDragStart, onDragOver, onDrop, autoEdit = false }: FieldEditorProps) {
  const [editing, setEditing] = useState(autoEdit);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(field.name);
  const [type, setType] = useState(field.fieldType);
  const [config, setConfig] = useState<JsonValue>(field.config);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (autoEdit) { setEditing(true); setName(field.name); requestAnimationFrame(() => nameInputRef.current?.select()); } }, [autoEdit, field.name]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [menuOpen]);

  function reset() { setName(field.name); setType(field.fieldType); setConfig(field.config); setEditing(false); }
  function updateConfig(key: string, value: JsonValue) { const current = config && typeof config === "object" && !Array.isArray(config) ? config : {}; setConfig({ ...current, [key]: value }); }
  async function save() { await onSave(field, name, type, config); setEditing(false); }

  return <article draggable={!field.isTitle} tabIndex={0} onKeyDown={(event) => { if (!field.isTitle && event.altKey && event.key === "ArrowUp") { event.preventDefault(); onViewMove(field.id, -1); } if (!field.isTitle && event.altKey && event.key === "ArrowDown") { event.preventDefault(); onViewMove(field.id, 1); } }} onDragStart={() => onDragStart(field.id)} onDragOver={onDragOver} onDrop={() => onDrop(field.id)} className="border-b border-(--module-scope-border-subtle) px-4 py-3 last:border-b-0">
    <div className="flex items-center gap-3">
      <span className="grid size-6 shrink-0 place-items-center text-(--module-scope-text-secondary)" title={FIELD_TYPE_LABELS[field.fieldType]} aria-hidden="true"><FieldTypeIcon type={field.fieldType} /></span>
      <div className="min-w-0 flex-1"><div className="truncate text-[13px] text-(--module-scope-text-primary)">{field.name}</div></div>
      <button type="button" aria-label={field.isTitle ? "主标题始终显示" : visible ? `隐藏 ${field.name}` : `显示 ${field.name}`} disabled={field.isTitle} className="rounded-(--r-sm) px-2 py-1 text-[12px] disabled:opacity-50" onClick={onVisibilityChange}><EyeIcon hidden={!visible && !field.isTitle} /></button>
      <div ref={menuRef} className="relative morfra-field-menu"><button ref={menuTriggerRef} type="button" aria-label={`${field.name} 更多操作`} aria-haspopup="menu" aria-expanded={menuOpen} className="rounded-(--r-sm) px-2 py-1 text-[12px]" onClick={() => setMenuOpen((value) => !value)}>•••</button>{menuOpen && <div className="absolute right-0 z-10 mt-1 grid min-w-28 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-1 shadow-(--shadow-dialog)" role="menu" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); requestAnimationFrame(() => menuTriggerRef.current?.focus()); } }}><button type="button" role="menuitem" autoFocus onClick={() => { setEditing(true); setMenuOpen(false); setName(field.name); setType(field.fieldType); setConfig(field.config); }}>字段设置</button>{!field.isTitle && <><button type="button" role="menuitem" onClick={() => { setEditing(true); setMenuOpen(false); }}>转换类型</button><button type="button" role="menuitem" className="text-(--module-scope-feedback-danger)" onClick={() => { setMenuOpen(false); onDelete(field); }}>删除字段</button></>}</div>}</div>
    </div>
    {editing && <div className="mt-3 space-y-3 rounded-(--r-sm) bg-(--module-scope-background-elevated) p-3">
      <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)">字段名<input ref={nameInputRef} className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1 text-(--module-scope-text-primary)" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(); if (event.key === "Escape") reset(); }} onBlur={() => { if (name.trim()) void save(); }} /></label>
      <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)">类型<select disabled={field.isTitle} className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1 text-(--module-scope-text-primary)" value={type} onChange={(event) => setType(event.target.value as FieldType)}>{(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((key) => <option key={key} value={key}>{FIELD_TYPE_LABELS[key]}</option>)}</select></label>
      {type === "text" && <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)"><input type="checkbox" checked={configValue(config, "multiline") === true} onChange={(event) => updateConfig("multiline", event.target.checked)} />支持多行显示</label>}
      {type === "number" && <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)">数字格式<select className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1 text-(--module-scope-text-primary)" value={typeof configValue(config, "format") === "string" ? configValue(config, "format") as string : "number"} onChange={(event) => updateConfig("format", event.target.value)}><option value="number">普通数字</option><option value="percent">百分数</option><option value="currency">货币</option></select></label>}
      {type === "date" && <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)"><input type="checkbox" checked={configValue(config, "includeTime") === true} onChange={(event) => updateConfig("includeTime", event.target.checked)} />包含具体时间</label>}
      {(type === "select" || type === "multi_select") && <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)"><input type="checkbox" checked={configValue(config, "allowCreate") !== false} onChange={(event) => updateConfig("allowCreate", event.target.checked)} />填写时允许新增选项</label>}
      <div className="flex justify-end gap-2"><button type="button" className="rounded-(--r-sm) border border-(--module-scope-border-subtle) px-2 py-1 text-[11px]" onClick={reset}>取消</button><button type="button" className="rounded-(--r-sm) bg-(--module-scope-action-base) px-2 py-1 text-[11px] text-(--module-scope-background-surface)" onClick={() => void save()}>保存</button></div>
      {(field.fieldType === "select" || field.fieldType === "multi_select") && <OptionEditor options={field.options} onCreate={(optionName, color) => onCreateOption(field.id, optionName, color)} onUpdate={onUpdateOption} onDelete={onDeleteOption} onReorder={(optionIds) => onReorderOption(field.id, optionIds)} />}
    </div>}
  </article>;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 3 18 18" /><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c5.4 0 9.2 4.3 10 6- .4.9-1.4 2.4-3 3.7M6.2 6.2C3.9 7.7 2.5 10 2 12c.8 1.7 4.6 6 10 6 1 0 2-.2 2.9-.6" /><circle cx="12" cy="12" r="3" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function configValue(config: JsonValue, key: string): JsonValue | undefined {
  if (!config || typeof config !== "object" || Array.isArray(config)) return undefined;
  return config[key];
}

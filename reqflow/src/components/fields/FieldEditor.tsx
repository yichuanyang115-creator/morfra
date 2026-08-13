import { useEffect, useRef, useState, type DragEvent } from "react";
import type { FieldGroupSummary, FieldOptionSummary, FieldSummary, FieldType, JsonValue } from "../../types/domain";
import { OptionEditor } from "./OptionEditor";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "文本", select: "单选", multi_select: "多选", number: "数字", progress: "进度", date: "日期", image: "图片", file: "文件", link: "链接", checkbox: "复选框", auto_number: "自动编号", created_time: "创建时间", updated_time: "最后编辑时间",
};

interface FieldEditorProps {
  field: FieldSummary;
  groups: FieldGroupSummary[];
  onSave: (field: FieldSummary, nextName: string, nextType: FieldType, config: JsonValue, groupId: string | null) => Promise<void>;
  onDelete: (field: FieldSummary) => void;
  onCreateOption: (fieldId: string, name: string, color?: string) => Promise<void>;
  onUpdateOption: (option: FieldOptionSummary, name: string, color: string) => Promise<void>;
  onDeleteOption: (option: FieldOptionSummary) => Promise<void>;
  onReorderOption: (fieldId: string, optionIds: string[]) => Promise<void>;
  onReorder: (fieldId: string, delta: -1 | 1) => Promise<void>;
  onDragStart: (fieldId: string) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (fieldId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  autoEdit?: boolean;
}

export function FieldEditor({ field, groups, onSave, onDelete, onCreateOption, onUpdateOption, onDeleteOption, onReorderOption, onReorder, onDragStart, onDragOver, onDrop, canMoveUp, canMoveDown, autoEdit = false }: FieldEditorProps) {
  const [editing, setEditing] = useState(autoEdit);
  const [name, setName] = useState(field.name);
  const [groupId, setGroupId] = useState(field.groupId);
  const [type, setType] = useState(field.fieldType);
  const [config, setConfig] = useState<JsonValue>(field.config);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoEdit) { setEditing(true); setName(field.name); requestAnimationFrame(() => nameInputRef.current?.select()); } }, [autoEdit, field.name]);

  function reset() { setName(field.name); setGroupId(field.groupId); setType(field.fieldType); setConfig(field.config); setEditing(false); }
  function updateConfig(key: string, value: JsonValue) { const current = config && typeof config === "object" && !Array.isArray(config) ? config : {}; setConfig({ ...current, [key]: value }); }
  async function save() { await onSave(field, name, type, config, groupId); setEditing(false); }

  return <article draggable onDragStart={() => onDragStart(field.id)} onDragOver={onDragOver} onDrop={() => onDrop(field.id)} className="border-b border-(--module-scope-border-subtle) px-4 py-3 last:border-b-0">
    <div className="flex items-center gap-3">
      <span className="w-5 text-center text-[11px] text-(--module-scope-text-tertiary)" aria-hidden="true">{field.isTitle ? "★" : "⋮⋮"}</span>
      <button type="button" aria-label={`上移${field.name}`} disabled={!canMoveUp} className="text-(--module-scope-text-tertiary) disabled:opacity-40" onClick={() => void onReorder(field.id, -1)}>↑</button><button type="button" aria-label={`下移${field.name}`} disabled={!canMoveDown} className="text-(--module-scope-text-tertiary) disabled:opacity-40" onClick={() => void onReorder(field.id, 1)}>↓</button>
      <div className="min-w-0 flex-1"><div className="truncate text-[13px] text-(--module-scope-text-primary)">{field.name}</div><div className="text-[11px] text-(--module-scope-text-tertiary)">{FIELD_TYPE_LABELS[field.fieldType]}{field.isTitle ? " · 主标题" : ""}</div></div>
      <button type="button" className="rounded-(--r-sm) border border-(--module-scope-border-subtle) px-2 py-1 text-[11px]" onClick={() => { setEditing((value) => !value); setName(field.name); setType(field.fieldType); setConfig(field.config); setGroupId(field.groupId); }}>{editing ? "收起" : "编辑"}</button>
      {!field.isTitle && <button type="button" className="rounded-(--r-sm) border border-transparent px-2 py-1 text-[11px] text-(--module-scope-feedback-danger)" onClick={() => onDelete(field)}>删除</button>}
    </div>
    {editing && <div className="mt-3 space-y-3 rounded-(--r-sm) bg-(--module-scope-background-elevated) p-3">
      <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)">字段名<input ref={nameInputRef} className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1 text-(--module-scope-text-primary)" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(); if (event.key === "Escape") reset(); }} onBlur={() => { if (name.trim()) void save(); }} /></label>
      <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)">类型<select disabled={field.isTitle} className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1 text-(--module-scope-text-primary)" value={type} onChange={(event) => setType(event.target.value as FieldType)}>{(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((key) => <option key={key} value={key}>{FIELD_TYPE_LABELS[key]}</option>)}</select></label>
      <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)">字段组<select disabled={field.isTitle} className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1 text-(--module-scope-text-primary)" value={groupId ?? ""} onChange={(event) => setGroupId(event.target.value || null)}><option value="">未分组</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      {type === "text" && <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)"><input type="checkbox" checked={configValue(config, "multiline") === true} onChange={(event) => updateConfig("multiline", event.target.checked)} />支持多行显示</label>}
      {type === "number" && <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)">数字格式<select className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1 text-(--module-scope-text-primary)" value={typeof configValue(config, "format") === "string" ? configValue(config, "format") as string : "number"} onChange={(event) => updateConfig("format", event.target.value)}><option value="number">普通数字</option><option value="percent">百分数</option><option value="currency">货币</option></select></label>}
      {type === "date" && <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)"><input type="checkbox" checked={configValue(config, "includeTime") === true} onChange={(event) => updateConfig("includeTime", event.target.checked)} />包含具体时间</label>}
      {(type === "select" || type === "multi_select") && <label className="flex items-center gap-2 text-[11px] text-(--module-scope-text-secondary)"><input type="checkbox" checked={configValue(config, "allowCreate") !== false} onChange={(event) => updateConfig("allowCreate", event.target.checked)} />填写时允许新增选项</label>}
      <div className="flex justify-end gap-2"><button type="button" className="rounded-(--r-sm) border border-(--module-scope-border-subtle) px-2 py-1 text-[11px]" onClick={reset}>取消</button><button type="button" className="rounded-(--r-sm) bg-(--module-scope-action-base) px-2 py-1 text-[11px] text-(--module-scope-background-surface)" onClick={() => void save()}>保存</button></div>
      {(field.fieldType === "select" || field.fieldType === "multi_select") && <OptionEditor options={field.options} onCreate={(optionName, color) => onCreateOption(field.id, optionName, color)} onUpdate={onUpdateOption} onDelete={onDeleteOption} onReorder={(optionIds) => onReorderOption(field.id, optionIds)} />}
    </div>}
  </article>;
}

function configValue(config: JsonValue, key: string): JsonValue | undefined {
  if (!config || typeof config !== "object" || Array.isArray(config)) return undefined;
  return config[key];
}

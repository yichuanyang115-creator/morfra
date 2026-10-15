import { useState } from "react";
import type { FieldSummary, JsonValue } from "../../types/domain";
import type { GridSelection } from "../../lib/table/selectionModel";
import { rangeBounds } from "../../lib/table/selectionModel";

interface GridContextMenuProps {
  x: number; y: number; field: FieldSummary | null; rowSelected: boolean; canClear: boolean; canSetValue: boolean; setValueReason: string;
  onCopy: () => void; onPaste: () => void; onClear: () => void; onDeleteRows: () => void; onOpenDetail: () => void;
  onSetValue: (value: JsonValue) => void; onClose: () => void;
}

export function GridContextMenu({ x, y, field, rowSelected, canClear, canSetValue, setValueReason, onCopy, onPaste, onClear, onDeleteRows, onOpenDetail, onSetValue, onClose }: GridContextMenuProps) {
  const [setting, setSetting] = useState(false);
  const [draft, setDraft] = useState<JsonValue>(defaultValue(field));
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (!field) return;
    const value = validateBatchValue(field, draft);
    if (value instanceof Error) { setError(value.message); return; }
    onSetValue(value);
    onClose();
  };
  return <div className="morfra-grid-context-menu" role="menu" style={{ left: x, top: y }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onClose(); }}>
    {setting && field ? <form onSubmit={(event) => { event.preventDefault(); submit(); }}><label>统一设置值<BatchValueEditor field={field} value={draft} onChange={(value) => { setDraft(value); setError(null); }} /></label>{error && <p role="alert">{error}</p>}<div><button type="button" onClick={() => setSetting(false)}>返回</button><button type="submit">设置</button></div></form> : <>
      {!rowSelected && <><button type="button" role="menuitem" onClick={onCopy}>复制 <kbd>⌘C</kbd></button><button type="button" role="menuitem" onClick={onPaste}>粘贴 <kbd>⌘V</kbd></button><button type="button" role="menuitem" disabled={!canClear} title={canClear ? undefined : "当前选区没有可清空的单元格"} onClick={onClear}>清空 <kbd>Delete</kbd></button><button type="button" role="menuitem" disabled={!canSetValue} title={canSetValue ? undefined : setValueReason} onClick={() => setSetting(true)}>统一设置值</button></>}
      {rowSelected && <><button type="button" role="menuitem" onClick={onOpenDetail}>打开详情</button><button type="button" role="menuitem" className="is-danger" onClick={onDeleteRows}>删除所选记录</button></>}
    </>}
  </div>;
}

function BatchValueEditor({ field, value, onChange }: { field: FieldSummary; value: JsonValue; onChange: (value: JsonValue) => void }) {
  if (field.fieldType === "checkbox") return <button type="button" className="morfra-grid-checkbox-editor" aria-label="统一设置复选框" aria-pressed={value === true} onClick={() => onChange(value !== true)}>{value === true ? "已勾选" : "未勾选"}</button>;
  if (field.fieldType === "select") return <select aria-label="统一设置值" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || null)}><option value="">未选择</option>{field.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>;
  if (field.fieldType === "multi_select") {
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return <fieldset aria-label="统一设置多选值">{field.options.map((option) => <label key={option.id}><input type="checkbox" checked={selected.includes(option.id)} onChange={() => onChange(selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id])} />{option.name}</label>)}</fieldset>;
  }
  const type = field.fieldType === "number" || field.fieldType === "progress" ? "number" : field.fieldType === "date" ? "date" : "text";
  return <input autoFocus aria-label="统一设置值" type={type} min={field.fieldType === "progress" ? 0 : undefined} max={field.fieldType === "progress" ? 100 : undefined} value={typeof value === "string" || typeof value === "number" ? String(value) : ""} onChange={(event) => onChange(event.target.value)} />;
}

function defaultValue(field: FieldSummary | null): JsonValue {
  if (field?.fieldType === "multi_select") return [];
  if (field?.fieldType === "checkbox") return false;
  return "";
}

export function validateBatchValue(field: FieldSummary, value: JsonValue): JsonValue | Error {
  if (field.fieldType === "checkbox") return value === true;
  if (field.fieldType === "select") return value === null || field.options.some((option) => option.id === value) ? value : new Error("请选择当前字段中的有效选项。");
  if (field.fieldType === "multi_select") return Array.isArray(value) && value.every((item) => typeof item === "string" && field.options.some((option) => option.id === item)) ? value : new Error("请选择当前字段中的有效选项。");
  if (field.fieldType === "number" || field.fieldType === "progress") {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const number = Number(raw);
    if (!Number.isFinite(number)) return new Error("请输入有效数字。");
    if (field.fieldType === "progress" && (number < 0 || number > 100)) return new Error("进度必须介于 0 到 100。");
    return number;
  }
  return typeof value === "string" ? value.trim() || null : value;
}

export function uniformValueAvailability(selection: GridSelection | null, fields: FieldSummary[]): { canSetValue: boolean; setValueReason: string } {
  if (!selection || selection.rows.length) return { canSetValue: false, setValueReason: "请在同一字段内选择多个单元格。" };
  const bounds = rangeBounds(selection.range);
  const field = fields[selection.active.column];
  const canSetValue = bounds.left === bounds.right && bounds.bottom > bounds.top && Boolean(field) && !field.id.startsWith("collapsed:") && !["auto_number", "created_time", "updated_time", "image", "file"].includes(field.fieldType);
  return { canSetValue, setValueReason: canSetValue ? "" : "统一设置值仅适用于同一字段内的多个可编辑单元格。" };
}

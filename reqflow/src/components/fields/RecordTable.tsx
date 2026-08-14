import { useState, type ChangeEvent } from "react";
import type { FieldSummary, JsonValue, RecordData, TableDataSnapshot } from "../../types/domain";
import { FIELD_TYPE_LABELS } from "./FieldTypeIcon";

interface RecordTableProps {
  data: TableDataSnapshot;
  onCreate: () => Promise<void>;
  onUpdate: (recordId: string, fieldId: string, value: JsonValue) => Promise<void>;
  onDelete: (recordId: string) => Promise<void>;
  onOpenDetail?: (recordId: string) => void;
  visibleFieldIds?: string[];
}

export function RecordTable({ data, onCreate, onUpdate, onDelete, onOpenDetail, visibleFieldIds }: RecordTableProps) {
  const [busy, setBusy] = useState(false);
  const requestedFields = visibleFieldIds ? visibleFieldIds.map((id) => data.fields.find((field) => field.id === id)).filter((field): field is FieldSummary => Boolean(field)) : data.fields;
  const titleField = data.fields.find((field) => field.isTitle);
  const fields = titleField ? [titleField, ...requestedFields.filter((field) => !field.isTitle)] : requestedFields;
  async function create() { setBusy(true); try { await onCreate(); } finally { setBusy(false); } }
  return <div className="mt-6 overflow-hidden border-y border-(--morfra-border-subtle) bg-(--morfra-surface-content)"><div className="flex items-center justify-between border-b border-(--morfra-border-subtle) px-3 py-2"><span className="text-[11px] text-(--morfra-text-secondary)">{data.records.length} 条记录 · {fields.length} 个字段</span><button type="button" disabled={busy} className="rounded-(--r-sm) bg-(--morfra-accent-primary) px-2.5 py-1 text-[11px] text-(--morfra-surface-content) disabled:opacity-50" onClick={() => void create()}>新建记录</button></div>{data.records.length === 0 ? <div className="px-4 py-10 text-center text-[12px] text-(--morfra-text-tertiary)">还没有记录，点击“新建记录”开始录入。</div> : <div className="overflow-auto"><table className="min-w-full border-collapse text-left text-[11px]"><thead><tr>{fields.map((field) => <th key={field.id} className="whitespace-nowrap border-b border-r border-(--morfra-border-subtle) bg-(--morfra-surface-canvas) px-3 py-2 font-medium text-(--morfra-text-secondary)">{field.name}<span className="ml-1 text-[9px] text-(--morfra-text-tertiary)">{FIELD_TYPE_LABELS[field.fieldType]}</span></th>)}<th className="border-b border-(--morfra-border-subtle) px-2" /></tr></thead><tbody>{data.records.map((record) => <RecordRow key={record.id} record={record} fields={fields} onUpdate={onUpdate} onDelete={onDelete} onOpenDetail={onOpenDetail} />)}</tbody></table></div>}</div>;
}

function RecordRow({ record, fields, onUpdate, onDelete, onOpenDetail }: { record: RecordData; fields: FieldSummary[]; onUpdate: RecordTableProps["onUpdate"]; onDelete: RecordTableProps["onDelete"]; onOpenDetail: RecordTableProps["onOpenDetail"] }) {
  return <tr>{fields.map((field) => <td key={field.id} className="min-w-[140px] border-b border-r border-(--morfra-border-subtle) px-2 py-1.5 align-top"><CellEditor record={record} field={field} onUpdate={onUpdate} /></td>)}<td className="border-b border-(--morfra-border-subtle) px-2 align-top"><button type="button" className="mr-2 text-[11px] text-(--morfra-accent-primary)" onClick={() => onOpenDetail?.(record.id)}>详情</button><button type="button" className="text-[11px] text-(--morfra-status-danger)" onClick={() => void onDelete(record.id)}>删除</button></td></tr>;
}

function CellEditor({ record, field, onUpdate }: { record: RecordData; field: FieldSummary; onUpdate: RecordTableProps["onUpdate"] }) {
  const value = record.values[field.id];
  if (field.fieldType === "auto_number" || field.fieldType === "created_time" || field.fieldType === "updated_time") return <span className="text-(--morfra-text-secondary)">{formatValue(value)}</span>;
  if (field.fieldType === "checkbox") return <input type="checkbox" checked={value === true} aria-label={`${field.name}复选框`} onChange={(event) => void onUpdate(record.id, field.id, event.target.checked)} />;
  if (field.fieldType === "select") return <select className="w-full min-w-0 bg-transparent text-(--morfra-text-primary) outline-none" value={typeof value === "string" ? value : ""} onChange={(event) => { if (event.target.value === "__new__") { const name = window.prompt("新增选项"); if (name?.trim()) void onUpdate(record.id, field.id, name.trim()); } else void onUpdate(record.id, field.id, event.target.value || null); }}><option value="">未选择</option>{field.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}{configValue(field.config, "allowCreate") !== false && <option value="__new__">＋新增选项</option>}</select>;
  if (field.fieldType === "multi_select") return <EditableMultiValue record={record} field={field} onUpdate={onUpdate} />;
  if (field.fieldType === "image") return <div className="space-y-1"><div className="flex gap-1">{attachmentValues(value).map((url) => <img key={url} src={url} alt={`${field.name}预览`} className="max-h-16 max-w-28 object-contain" />)}</div><EditableValue record={record} field={field} value={value} onUpdate={onUpdate} /></div>;
  if (field.fieldType === "file") return <div className="space-y-1">{attachmentValues(value).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="mr-2 text-(--morfra-accent-primary) underline">{fileName(url)}</a>)}<EditableValue record={record} field={field} value={value} onUpdate={onUpdate} /></div>;
  if (field.fieldType === "number") return <div className="flex items-center gap-1"><EditableValue record={record} field={field} value={value} onUpdate={onUpdate} /><span className="text-(--morfra-text-tertiary)">{numberSuffix(field.config)}</span></div>;
  return <EditableValue record={record} field={field} value={value} onUpdate={onUpdate} />;
}

function EditableValue({ record, field, value, onUpdate }: { record: RecordData; field: FieldSummary; value: JsonValue | undefined; onUpdate: RecordTableProps["onUpdate"] }) {
  const [draft, setDraft] = useState(field.fieldType === "image" || field.fieldType === "file" ? attachmentValues(value).join(", ") : formatValue(value));
  const inputType = field.fieldType === "number" || field.fieldType === "progress" ? "number" : field.fieldType === "date" ? (configValue(field.config, "includeTime") === true ? "datetime-local" : "date") : "text";
  const multiline = field.fieldType === "text" && configValue(field.config, "multiline") === true;
  const inputProps = { className: "w-full min-w-0 bg-transparent text-(--morfra-text-primary) outline-none", value: draft, placeholder: field.fieldType === "image" || field.fieldType === "file" ? "多个 URL 用逗号分隔" : "—", onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value), onBlur: () => { const next = draft.trim(); const current = field.fieldType === "image" || field.fieldType === "file" ? attachmentValues(value).join(", ") : formatValue(value); if (next === current) return; const normalized: JsonValue = field.fieldType === "image" || field.fieldType === "file" ? next.split(/[\n,]/).map((item) => item.trim()).filter(Boolean) : next === "" ? null : inputType === "number" ? Number(next) : next; void onUpdate(record.id, field.id, normalized); } };
  return multiline ? <textarea {...inputProps} rows={2} /> : <input {...inputProps} type={inputType} min={field.fieldType === "progress" ? 0 : undefined} max={field.fieldType === "progress" ? 100 : undefined} />;
}

function formatValue(value: JsonValue | undefined): string { if (value === undefined || value === null) return ""; if (typeof value === "object") return JSON.stringify(value); return String(value); }

function configValue(config: JsonValue, key: string): JsonValue | undefined { return config && typeof config === "object" && !Array.isArray(config) ? config[key] : undefined; }

function fileName(value: string): string { try { return decodeURIComponent(new URL(value).pathname.split("/").pop() || value); } catch { return value; } }
function attachmentValues(value: JsonValue | undefined): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" && value ? [value] : []; }

function numberSuffix(config: JsonValue): string { const format = config && typeof config === "object" && !Array.isArray(config) ? config.format : undefined; return format === "percent" ? "%" : format === "currency" ? "¤" : ""; }

function EditableMultiValue({ record, field, onUpdate }: { record: RecordData; field: FieldSummary; onUpdate: RecordTableProps["onUpdate"] }) {
  const selected = record.multiSelectValues[field.id] ?? [];
  const [draft, setDraft] = useState(selected.map((id) => field.options.find((option) => option.id === id)?.name ?? id).join(", "));
  return <input className="w-full min-w-0 bg-transparent text-(--morfra-text-primary) outline-none" aria-label={`${field.name}多选`} value={draft} placeholder="用逗号分隔" onChange={(event) => setDraft(event.target.value)} onBlur={() => { const values = draft.split(",").map((item) => item.trim()).filter(Boolean).map((item) => field.options.find((option) => option.id === item || option.name === item)?.id ?? item); void onUpdate(record.id, field.id, values); }} />;
}

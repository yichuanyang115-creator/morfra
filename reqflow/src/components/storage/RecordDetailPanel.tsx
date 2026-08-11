import { useEffect } from "react";
import { currentProject, useProjectStore } from "../../stores/projectStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useTableDataStore } from "../../stores/tableDataStore";
import { useStorageSelectionStore } from "../../stores/storageSelectionStore";
import type { FieldSummary } from "../../types/domain";
import { FIELD_TYPE_LABELS } from "../fields/FieldEditor";

export function StorageRecordDetailPanel() {
  const project = useProjectStore(currentProject);
  const activeTableByProject = useWorkspaceStore((state) => state.activeTableByProject);
  const dataByTable = useTableDataStore((state) => state.dataByTable);
  const selectedByTable = useStorageSelectionStore((state) => state.selectedRecordByTable);
  const detailFieldsByTable = useStorageSelectionStore((state) => state.detailFieldsByTable);
  const loadDetailFields = useStorageSelectionStore((state) => state.loadDetailFields);
  const tableId = project ? activeTableByProject[project.id] ?? project.storageSnapshot?.tables[0]?.id : undefined;
  const data = tableId ? dataByTable[tableId] : undefined;
  const selectedId = tableId ? selectedByTable[tableId] : undefined;
  const record = data?.records.find((item) => item.id === selectedId);
  const titleField = data?.fields.find((field) => field.isTitle);
  const detailFields = tableId ? detailFieldsByTable[tableId] : undefined;

  useEffect(() => { if (tableId && detailFields === undefined) loadDetailFields(tableId); }, [detailFields, loadDetailFields, tableId]);

  if (!data || !record || !titleField) return <div className="morfra-context-empty"><span className="morfra-empty-symbol">○</span><p>选择一条记录查看详情</p><span>主标题和详情属性会显示在这里</span></div>;
  const fields = (detailFields ?? []).map((id) => data.fields.find((field) => field.id === id)).filter((field): field is FieldSummary => field !== undefined && !field.isTitle);
  return <div className="space-y-5 px-4 py-5" data-testid="storage-record-detail"><header><p className="m-0 text-[10px] uppercase tracking-widest text-(--module-scope-text-tertiary)">记录详情</p><h2 className="m-0 mt-2 text-[18px] font-semibold text-(--module-scope-text-primary)">{formatValue(record.values[titleField.id]) || "未命名记录"}</h2><p className="m-0 mt-1 text-[11px] text-(--module-scope-text-tertiary)">#{record.autoNumber} · {record.updatedAt}</p></header>{fields.length === 0 ? <p className="m-0 border-t border-(--module-scope-border-subtle) pt-4 text-[12px] text-(--module-scope-text-tertiary)">尚未配置详情属性。使用“详情属性”选择要展示的字段。</p> : <dl className="space-y-4 border-t border-(--module-scope-border-subtle) pt-4">{fields.map((field) => <div key={field.id}><dt className="text-[10px] text-(--module-scope-text-tertiary)">{field.name} · {FIELD_TYPE_LABELS[field.fieldType]}</dt><dd className="m-0 mt-1 break-words text-[12px] text-(--module-scope-text-primary)"><DetailValue field={field} value={record.values[field.id]} record={record} /></dd></div>)}</dl>}</div>;
}

function DetailValue({ field, value, record }: { field: FieldSummary; value: unknown; record: { multiSelectValues: Record<string, string[]> } }) {
  if (field.fieldType === "select" && typeof value === "string") return <span>{field.options.find((option) => option.id === value)?.name ?? value}</span>;
  if (field.fieldType === "multi_select") return <span>{(record.multiSelectValues[field.id] ?? []).map((id) => field.options.find((option) => option.id === id)?.name ?? id).join("、") || "—"}</span>;
  if (field.fieldType === "number") return <span>{formatNumberValue(value, field.config)}</span>;
  if (field.fieldType === "image") return <span className="flex flex-wrap gap-1">{attachmentValues(value).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${field.name}预览`} className="max-h-40 max-w-full object-contain" /></a>)}</span>;
  if (field.fieldType === "file") return <span>{attachmentValues(value).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="mr-2 text-(--module-scope-action-base) underline">{fileName(url)}</a>)}</span>;
  if (field.fieldType === "link" && typeof value === "string" && value) return <a href={value} target="_blank" rel="noreferrer" className="text-(--module-scope-action-base) underline">{value}</a>;
  return <span>{formatValue(value)}</span>;
}

function formatValue(value: unknown, record?: { multiSelectValues: Record<string, string[]> }, fieldId?: string): string {
  if (record && fieldId) { const values = record.multiSelectValues[fieldId]; if (values) return values.join("、") || "—"; }
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function fileName(value: string): string { try { return decodeURIComponent(new URL(value).pathname.split("/").pop() || value); } catch { return value; } }
function attachmentValues(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" && value ? [value] : []; }

function formatNumberValue(value: unknown, config: unknown): string {
  if (typeof value !== "number") return formatValue(value);
  const format = config && typeof config === "object" && !Array.isArray(config) ? (config as Record<string, unknown>).format : undefined;
  return format === "percent" ? `${value}%` : format === "currency" ? `¤${value}` : String(value);
}

import { useEffect, useRef, useState } from "react";
import { currentProject, useProjectStore } from "../../stores/projectStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useTableDataStore } from "../../stores/tableDataStore";
import { useStorageSelectionStore } from "../../stores/storageSelectionStore";
import type { FieldSummary, RecordDetailContent, StorageDetailTab } from "../../types/domain";
import { FIELD_TYPE_LABELS } from "../fields/FieldEditor";
import { ActivityFieldBinding } from "../settings/ActivityFieldBinding";
import { StorageRecordDetailTabs } from "../detail/tabs/StorageRecordDetailTabs";
import {
  createStorageActivityComment,
  deleteStorageActivityEvent,
  getStorageDetailTabs,
  loadStorageActivityEvents,
  loadStorageRecordDetailContent,
  saveStorageRecordDetailContent,
  updateStorageActivityNote,
} from "../../lib/ipc/storageClient";
import type { ActivityEvent } from "../../types/domain";

export function StorageRecordDetailPanel() {
  const project = useProjectStore(currentProject);
  const activeTableByProject = useWorkspaceStore((state) => state.activeTableByProject);
  const dataByTable = useTableDataStore((state) => state.dataByTable);
  const selectedByTable = useStorageSelectionStore((state) => state.selectedRecordByTable);
  const detailFieldsByTable = useStorageSelectionStore((state) => state.detailFieldsByTable);
  const loadDetailFields = useStorageSelectionStore((state) => state.loadDetailFields);
  const updateCell = useTableDataStore((state) => state.updateCell);
  const tableId = project ? activeTableByProject[project.id] ?? project.storageSnapshot?.tables[0]?.id : undefined;
  const data = tableId ? dataByTable[tableId] : undefined;
  const selectedId = tableId ? selectedByTable[tableId] : undefined;
  const record = data?.records.find((item) => item.id === selectedId);
  const titleField = data?.fields.find((field) => field.isTitle);
  const detailFields = tableId ? detailFieldsByTable[tableId] : undefined;
  const [activityOpen, setActivityOpen] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [tabs, setTabs] = useState<StorageDetailTab[]>([]);
  const [tabsError, setTabsError] = useState<string | null>(null);
  const [tabsLoadRetry, setTabsLoadRetry] = useState(0);
  const [content, setContent] = useState<RecordDetailContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const contentSaveQueue = useRef(Promise.resolve());

  useEffect(() => {
    if (tableId && detailFields === undefined) void loadDetailFields(tableId);
  }, [detailFields, loadDetailFields, tableId]);

  useEffect(() => {
    if (!tableId) {
      setTabs([]);
      setTabsError(null);
      return;
    }
    setTabsError(null);
    void getStorageDetailTabs(tableId).then(setTabs).catch(() => {
      setTabs([]);
      setTabsError("详情 Tab 配置读取失败，请重试");
    });
  }, [tableId, tabsLoadRetry]);

  useEffect(() => {
    if (!record) {
      setEvents([]);
      return;
    }
    setEventsLoading(true);
    setEventsError(null);
    void loadStorageActivityEvents(record.id)
      .then(setEvents)
      .catch(() => setEventsError("活动记录读取失败，请重试"))
      .finally(() => setEventsLoading(false));
  }, [record?.id]);

  useEffect(() => {
    if (!record) {
      setContent(null);
      return;
    }
    setContent(emptyDetailContent(record.id));
    setContentLoading(true);
    setContentError(null);
    void loadStorageRecordDetailContent(record.id)
      .then(setContent)
      .catch(() => setContentError("详情内容读取失败，请重试"))
      .finally(() => setContentLoading(false));
  }, [record?.id]);

  if (!data || !record || !titleField) {
    return <div className="morfra-context-empty"><span className="morfra-empty-symbol">○</span><p>选择一条记录查看详情</p><span>主标题和详情属性会显示在这里</span></div>;
  }

  const fields = (detailFields ?? [])
    .map((id) => data.fields.find((field) => field.id === id))
    .filter((field): field is FieldSummary => field !== undefined && !field.isTitle);
  const selectedValues = Object.fromEntries(fields.map((field) => [field.id, typeof record.values[field.id] === "string" ? record.values[field.id] : ""])) as Record<string, string>;
  const refreshEvents = () => loadStorageActivityEvents(record.id).then(setEvents).catch(() => setEventsError("活动记录读取失败，请重试"));
  const saveContent = (next: RecordDetailContent) => {
    setContent(next);
    setContentError(null);
    contentSaveQueue.current = contentSaveQueue.current.catch(() => undefined).then(async () => {
      const saved = await saveStorageRecordDetailContent(record.id, {
        body: next.body,
        deliverables: next.deliverables,
        tasks: next.tasks,
        acceptance: next.acceptance,
      });
      setContent((current) => current?.recordId === saved.recordId ? saved : current);
    }).catch(() => setContentError("详情内容保存失败，请重试"));
  };

  return (
    <div className="space-y-5 px-4 py-5" data-testid="storage-record-detail">
      <DetailHeader title={formatValue(record.values[titleField.id]) || "未命名记录"} autoNumber={record.autoNumber} updatedAt={record.updatedAt} />
      {fields.length > 0 ? <DetailProperties fields={fields} record={record} selectedValues={selectedValues} onUpdate={updateCell} /> : null}
      {tabsError ? <p role="alert" className="text-[12px] text-(--module-scope-feedback-danger)">{tabsError}<button type="button" className="ml-2 underline" onClick={() => setTabsLoadRetry((value) => value + 1)}>重试</button></p> : null}
      {content ? <StorageRecordDetailTabs tabs={tabs} content={content} contentLoading={contentLoading} events={events} eventsLoading={eventsLoading} eventsError={eventsError} onSaveContent={saveContent} onOpenActivitySettings={() => setActivityOpen(true)} onUpdateActivityNote={async (id, note) => { await updateStorageActivityNote(id, note); await refreshEvents(); }} onAddActivityComment={async (id, comment) => { await createStorageActivityComment(id, comment); await refreshEvents(); }} onDeleteActivityEvent={async (id) => { await deleteStorageActivityEvent(id); await refreshEvents(); }} /> : null}
      {contentError ? <p role="alert" className="text-[12px] text-(--module-scope-feedback-danger)">{contentError}</p> : null}
      {activityOpen && tableId ? <ActivityFieldBinding tableId={tableId} fields={data.fields} onClose={() => { setActivityOpen(false); void refreshEvents(); }} /> : null}
    </div>
  );
}

function DetailHeader({ title, autoNumber, updatedAt }: { title: string; autoNumber: number; updatedAt: string }) {
  return <header><div className="flex items-start justify-between gap-2"><div><p className="m-0 text-[10px] uppercase tracking-widest text-(--module-scope-text-tertiary)">记录详情</p><h2 className="m-0 mt-2 text-[18px] font-semibold text-(--module-scope-text-primary)">{title}</h2></div><button type="button" className="text-[11px]" onClick={() => window.dispatchEvent(new CustomEvent("open-storage-detail-field-settings"))}>显示字段</button></div><p className="m-0 mt-1 text-[11px] text-(--module-scope-text-tertiary)">#{autoNumber} · {updatedAt}</p></header>;
}

function DetailProperties({ fields, record, selectedValues, onUpdate }: { fields: FieldSummary[]; record: { id: string; values: Record<string, unknown>; multiSelectValues: Record<string, string[]> }; selectedValues: Record<string, string>; onUpdate: (recordId: string, fieldId: string, value: import("../../types/domain").JsonValue) => Promise<unknown> }) {
  return <dl className="space-y-4 border-t border-(--module-scope-border-subtle) pt-4">{fields.map((field) => <div key={field.id}><dt className="text-[10px] text-(--module-scope-text-tertiary)">{field.name} · {FIELD_TYPE_LABELS[field.fieldType]}</dt><dd className="m-0 mt-1 flex items-start justify-between gap-2 break-words text-[12px] text-(--module-scope-text-primary)">{field.fieldType === "select" ? <select aria-label={`编辑${field.name}`} value={selectedValues[field.id]} onChange={(event) => void onUpdate(record.id, field.id, event.target.value || null)}><option value="">空</option>{field.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select> : <><DetailValue field={field} value={record.values[field.id]} record={record} /><button type="button" aria-label={`编辑${field.name}`} onClick={() => { const next = window.prompt(`编辑${field.name}`, formatValue(record.values[field.id])); if (next !== null) void onUpdate(record.id, field.id, next); }}>编辑</button></>}</dd></div>)}</dl>;
}

function emptyDetailContent(recordId: string): RecordDetailContent { return { recordId, body: "", deliverables: [], tasks: [], acceptance: [] }; }

function DetailValue({ field, value, record }: { field: FieldSummary; value: unknown; record: { multiSelectValues: Record<string, string[]> } }) {
  if (field.fieldType === "select" && typeof value === "string") return <span>{field.options.find((option) => option.id === value)?.name ?? value}</span>;
  if (field.fieldType === "multi_select") return <span>{(record.multiSelectValues[field.id] ?? []).map((id) => field.options.find((option) => option.id === id)?.name ?? id).join("、") || "—"}</span>;
  if (field.fieldType === "number") return <span>{formatNumberValue(value, field.config)}</span>;
  if (field.fieldType === "image") return <span className="flex flex-wrap gap-1">{attachmentValues(value).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${field.name}预览`} className="max-h-40 max-w-full object-contain" /></a>)}</span>;
  if (field.fieldType === "file") return <span>{attachmentValues(value).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="mr-2 text-(--module-scope-action-base) underline">{fileName(url)}</a>)}</span>;
  if (field.fieldType === "link" && typeof value === "string" && value) return <a href={value} target="_blank" rel="noreferrer" className="text-(--module-scope-action-base) underline">{value}</a>;
  return <span>{formatValue(value)}</span>;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function fileName(value: string): string { try { return decodeURIComponent(new URL(value).pathname.split("/").pop() || value); } catch { return value; } }
function attachmentValues(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" && value ? [value] : []; }
function formatNumberValue(value: unknown, config: unknown): string { if (typeof value !== "number") return formatValue(value); const format = config && typeof config === "object" && !Array.isArray(config) ? (config as Record<string, unknown>).format : undefined; return format === "percent" ? `${value}%` : format === "currency" ? `¤${value}` : String(value); }

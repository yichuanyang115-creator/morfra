import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { FieldOptionSummary, FieldSummary, FieldType, JsonValue, TableDataSnapshot } from "../../types/domain";
import { previewFieldConversion, type ConversionPreview } from "../../lib/fields/valueConversion";
import { useTableDataStore } from "../../stores/tableDataStore";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { FieldEditor } from "./FieldEditor";
import { FieldEditPage, type FieldDraft } from "./FieldEditPage";
import { FieldTypeConversionDialog } from "./FieldTypeConversionDialog";
import { FieldTypePicker } from "./FieldTypePicker";
import { getStorageActivityBinding } from "../../lib/ipc/storageClient";

interface FieldManagerProps {
  tableId: string;
  data: TableDataSnapshot;
  anchor: HTMLElement | null;
  onClose: (restoreFocus?: boolean) => void;
  onError: (message: string) => void;
  viewLayout?: { visibleFieldIds: string[]; fieldOrder: string[]; onChange: (fieldOrder: string[], visibleFieldIds: string[]) => void; onFieldCreated: (field: FieldSummary) => void; onReset: () => void };
}

interface PendingConversion {
  field: FieldSummary;
  name: string;
  nextType: FieldType;
  config: JsonValue;
  preview: ConversionPreview;
}

interface PendingFieldDelete {
  field: FieldSummary;
  restoreFocus: () => void;
}
interface PendingOptionImpact { field: FieldSummary; draft: FieldDraft; option: FieldOptionSummary; recordCount: number; viewRuleCount: number; }


export function FieldManager({ tableId, data, anchor, onClose, onError, viewLayout }: FieldManagerProps) {
  const createField = useTableDataStore((state) => state.createField);
  const updateField = useTableDataStore((state) => state.updateField);
  const applyFieldDraft = useTableDataStore((state) => state.applyFieldDraft);
  const optionUsage = useTableDataStore((state) => state.optionUsage);
  const deleteField = useTableDataStore((state) => state.deleteField);
  const [fieldTypePickerOpen, setFieldTypePickerOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldSummary | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [listScrollTop, setListScrollTop] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const lastEditFieldId = useRef<string | null>(null);
  const [position, setPosition] = useState<CSSProperties>();
  const [pendingDelete, setPendingDelete] = useState<PendingFieldDelete | null>(null);
  const [pendingConversion, setPendingConversion] = useState<PendingConversion | null>(null);
  const [pendingDraft, setPendingDraft] = useState<{ field: FieldSummary; draft: FieldDraft } | null>(null);
  const [pendingOptionImpact, setPendingOptionImpact] = useState<PendingOptionImpact | null>(null);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [activityFieldId, setActivityFieldId] = useState<string | null>(null);

  useEffect(() => { void getStorageActivityBinding(tableId).then((binding) => setActivityFieldId(binding.fieldId)).catch(() => setActivityFieldId(null)); requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLButtonElement>("[data-field-edit-id]")?.focus()); }, [tableId]);
  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(280, window.innerWidth - 24);
      const maxHeight = Math.max(180, window.innerHeight - 24);
      const opensUpward = rect.bottom + 6 + Math.min(620, maxHeight) > window.innerHeight && rect.top > window.innerHeight - rect.bottom;
      setPosition(opensUpward
        ? { position: "fixed", zIndex: 1000, bottom: window.innerHeight - rect.top + 6, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), width, maxHeight }
        : { position: "fixed", zIndex: 1000, top: rect.bottom + 6, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), width, maxHeight });
    };
    place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (document.querySelector("[role='dialog'][aria-modal='true']") || dialogRef.current?.contains(target) || anchor?.contains(target)) return;
      closeManager(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [anchor]);

  async function run(action: () => Promise<unknown>, message: string) { try { await action(); } catch (error) { onError(error instanceof Error ? error.message : message); } }
  async function addField(fieldType: FieldType, name: string) { const knownIds = new Set(data.fields.map((field) => field.id)); const snapshot = await createField(tableId, name, fieldType, {}); const created = snapshot.fields.find((field) => !knownIds.has(field.id)); if (!created) throw new Error("字段创建结果缺失"); viewLayout?.onFieldCreated(created); setEditorError(null); }
  const restoreEditFocus = () => requestAnimationFrame(() => { const id = lastEditFieldId.current; if (id) dialogRef.current?.querySelector<HTMLButtonElement>(`[data-field-edit-id="${id}"]`)?.focus(); });
  async function submitDraft(field: FieldSummary, draft: FieldDraft, replacement?: { optionId: string; replacementId: string | null }) { try { setSavingDraft(true); await applyFieldDraft(field.id, field.name, draft.fieldType, draft.config, draft.options.filter(option => !option.deleted).map(({ id, name, color, position, isNew }) => ({ id: isNew ? undefined : id, name, color, position })), draft.options.filter(option => option.deleted && !option.isNew).map(option => ({ optionId: option.id, mode: replacement?.optionId === option.id && replacement.replacementId ? "replace" as const : "clear" as const, replacementId: replacement?.optionId === option.id ? replacement.replacementId : null }))); setEditorError(null); leaveEditor(); return true; } catch (error) { setEditorError(error instanceof Error ? error.message : "字段保存失败，请重试"); return false; } finally { setSavingDraft(false); } }
  async function saveField(field: FieldSummary, draft: FieldDraft) { const deleted = draft.options.filter(option => option.deleted && !option.isNew); for (const option of deleted) { const usage = await optionUsage(option.id); if (usage.recordCount || usage.viewRuleCount) { setPendingOptionImpact({ field, draft, option, ...usage }); return false; } } if (draft.fieldType !== field.fieldType) { setPendingDraft({ field, draft }); setPendingConversion({ field, name: field.name, nextType: draft.fieldType, config: draft.config, preview: previewFieldConversion(data, field.id, draft.fieldType) }); return false; } return submitDraft(field, draft); }
  async function renameField(field: FieldSummary, name: string) { try { await updateField(field.id, name, field.fieldType, field.config); } catch (error) { onError(error instanceof Error ? error.message : "字段重命名失败，请重试"); throw error; } }
  async function confirmConversion() { if (!pendingDraft) return; const pending = pendingDraft; setPendingConversion(null); setPendingDraft(null); await submitDraft(pending.field, pending.draft); if (pending.field.id === activityFieldId && pending.draft.fieldType !== "select") setActivityFieldId(null); }
  async function confirmFieldDelete() { if (!pendingDelete) return; const pending = pendingDelete; setPendingDelete(null); await run(() => deleteField(pending.field.id), "字段删除失败"); if (pending.field.id === activityFieldId) setActivityFieldId(null); }
  const orderedFields = viewLayout ? [...data.fields].sort((left, right) => viewLayout.fieldOrder.indexOf(left.id) - viewLayout.fieldOrder.indexOf(right.id)) : data.fields;
  function moveViewField(fieldId: string, delta: -1 | 1) { if (!viewLayout) return; const index = viewLayout.fieldOrder.indexOf(fieldId); const nextIndex = index + delta; if (index <= 0 || nextIndex <= 0 || nextIndex >= viewLayout.fieldOrder.length) return; const next = [...viewLayout.fieldOrder]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; viewLayout.onChange(next, viewLayout.visibleFieldIds); }
  function dropField(fieldId: string) { if (!viewLayout || !draggedFieldId || draggedFieldId === fieldId || !viewLayout.fieldOrder.includes(draggedFieldId) || !viewLayout.fieldOrder.includes(fieldId)) return; const next = [...viewLayout.fieldOrder]; const from = next.indexOf(draggedFieldId); const to = next.indexOf(fieldId); next.splice(from, 1); next.splice(to, 0, draggedFieldId); setDraggedFieldId(null); viewLayout.onChange(next, viewLayout.visibleFieldIds); }
  function toggleVisibility(fieldId: string) { if (!viewLayout) return; const visible = new Set(viewLayout.visibleFieldIds); if (visible.has(fieldId)) visible.delete(fieldId); else visible.add(fieldId); viewLayout.onChange(viewLayout.fieldOrder, viewLayout.fieldOrder.filter((id) => visible.has(id))); }

  function leaveEditor() { setEditorError(null); setSelectedField(null); restoreEditFocus(); }
  function closeManager(restoreFocus = true) { onClose(restoreFocus); if (restoreFocus) requestAnimationFrame(() => anchor?.focus()); }

  const manager = <section id="field-manager-popover" ref={dialogRef} style={position} className="morfra-field-manager-panel flex min-h-0 flex-col overflow-hidden rounded-(--r-lg) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) shadow-(--shadow-panel)" role="dialog" aria-modal="false" aria-labelledby="field-manager-title" onKeyDown={(event) => { if (event.key === "Escape" && !document.querySelector(".morfra-field-manager-panel [role='dialog'][aria-modal='true']")) { event.preventDefault(); selectedField ? leaveEditor() : closeManager(); } }}>
    {selectedField ? <FieldEditPage field={data.fields.find((field) => field.id === selectedField.id) ?? selectedField} error={editorError} saving={savingDraft} onBack={leaveEditor} onSave={saveField} /> : <><header className="flex items-center justify-between border-b border-(--module-scope-border-subtle) px-3 py-2"><h2 id="field-manager-title" className="m-0 text-[13px] font-semibold">字段管理</h2><button type="button" className="rounded-(--r-sm) px-1.5 py-1 text-[11px] text-(--module-scope-text-secondary)" onClick={() => closeManager()}>关闭</button></header><div className="min-h-0 flex-1 overflow-y-auto p-2" onScroll={(event) => setListScrollTop(event.currentTarget.scrollTop)} ref={(node) => { if (node) node.scrollTop = listScrollTop; }}><section>{orderedFields.map((field) => <FieldEditor key={field.id} field={field} visible={viewLayout?.visibleFieldIds.includes(field.id) ?? true} onEdit={(next) => { lastEditFieldId.current = next.id; setSelectedField(next); setEditorError(null); }} onRename={renameField} onViewMove={moveViewField} onVisibilityChange={() => toggleVisibility(field.id)} onDragStart={setDraggedFieldId} onDragOver={(event) => event.preventDefault()} onDrop={dropField} onDelete={(field, restoreFocus) => setPendingDelete({ field, restoreFocus })} />)}</section></div><footer className="border-t border-(--module-scope-border-subtle) p-2">{fieldTypePickerOpen ? <FieldTypePicker inline onCreate={async (fieldType, name) => { await addField(fieldType, name); setFieldTypePickerOpen(false); }} onClose={() => setFieldTypePickerOpen(false)} /> : <button type="button" className="rounded-(--r-sm) bg-(--module-scope-action-base) px-2 py-1 text-[11px] text-(--module-scope-background-surface)" onClick={() => setFieldTypePickerOpen(true)}>＋ 新增字段</button>}</footer></>}
    {pendingDelete && <ConfirmDialog title={`删除“${pendingDelete.field.name}”？`} body={`字段值会被删除，所有视图中对它的显示、筛选、排序和分组引用会被清理；操作可撤销。${pendingDelete.field.id === activityFieldId ? "该字段是活动关联字段，确认后活动跟踪将停止；已有历史会保留。" : ""}`} confirmLabel="删除字段" onCancel={() => { const restoreFocus = pendingDelete.restoreFocus; setPendingDelete(null); requestAnimationFrame(restoreFocus); }} onConfirm={() => void confirmFieldDelete()} />}
    {pendingConversion && <FieldTypeConversionDialog preview={pendingConversion.preview} activityTrackingStops={pendingConversion.field.id === activityFieldId && pendingConversion.nextType !== "select"} onCancel={() => { setPendingConversion(null); setPendingDraft(null); }} onConfirm={() => void confirmConversion()} />}
    {pendingOptionImpact && <OptionImpactDialog pending={pendingOptionImpact} onCancel={() => setPendingOptionImpact(null)} onConfirm={(replacementId) => { const pending = pendingOptionImpact; setPendingOptionImpact(null); void submitDraft(pending.field, pending.draft, { optionId: pending.option.id, replacementId }); }} />}
  </section>;
  return typeof document === "undefined" ? manager : createPortal(manager, document.body);
}
function OptionImpactDialog({ pending, onCancel, onConfirm }: { pending: PendingOptionImpact; onCancel: () => void; onConfirm: (replacementId: string | null) => void }) { const [replacementId, setReplacementId] = useState<string | null>(null); const replacements = pending.draft.options.filter(option => !option.deleted && !option.isNew && option.id !== pending.option.id); return <div role="dialog" aria-modal="true" className="fixed inset-0 z-70 grid place-items-center bg-(--overlay-scrim)"><div className="w-90 rounded-(--r-lg) bg-(--module-scope-background-surface) p-5"><h2>删除选项“{pending.option.name}”</h2><p>{`将影响 ${pending.recordCount} 条记录和 ${pending.viewRuleCount} 条视图规则。`}</p>{replacements.length > 0 && <div><button type="button" onClick={() => setReplacementId(null)}>清空引用</button>{replacements.map(option => <button key={option.id} type="button" onClick={() => setReplacementId(option.id)}>替换为 {option.name}</button>)}</div>}<button type="button" onClick={onCancel}>取消</button><button type="button" onClick={() => onConfirm(replacementId)}>确认</button></div></div>; }

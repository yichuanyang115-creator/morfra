import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { FieldOptionSummary, FieldSummary, FieldType, JsonValue, TableDataSnapshot } from "../../types/domain";
import { previewFieldConversion, type ConversionPreview } from "../../lib/fields/valueConversion";
import { useTableDataStore } from "../../stores/tableDataStore";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { FieldEditor } from "./FieldEditor";
import { FieldEditPage } from "./FieldEditPage";
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

interface PendingOptionDelete {
  option: FieldOptionSummary;
  recordCount: number;
  viewRuleCount: number;
}

export function FieldManager({ tableId, data, anchor, onClose, onError, viewLayout }: FieldManagerProps) {
  const createField = useTableDataStore((state) => state.createField);
  const updateField = useTableDataStore((state) => state.updateField);
  const deleteField = useTableDataStore((state) => state.deleteField);
  const createOption = useTableDataStore((state) => state.createOption);
  const updateOption = useTableDataStore((state) => state.updateOption);
  const reorderOptions = useTableDataStore((state) => state.reorderOptions);
  const optionUsage = useTableDataStore((state) => state.optionUsage);
  const deleteOption = useTableDataStore((state) => state.deleteOption);
  const [fieldTypePickerOpen, setFieldTypePickerOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldSummary | null>(null);
  const [, setDraftDirty] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [listScrollTop, setListScrollTop] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const lastEditFieldId = useRef<string | null>(null);
  const [position, setPosition] = useState<CSSProperties>();
  const [pendingDelete, setPendingDelete] = useState<PendingFieldDelete | null>(null);
  const [pendingOptionDelete, setPendingOptionDelete] = useState<PendingOptionDelete | null>(null);
  const [pendingConversion, setPendingConversion] = useState<PendingConversion | null>(null);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [activityFieldId, setActivityFieldId] = useState<string | null>(null);

  useEffect(() => { void getStorageActivityBinding(tableId).then((binding) => setActivityFieldId(binding.fieldId)).catch(() => setActivityFieldId(null)); requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLButtonElement>("[data-field-edit-id]")?.focus()); }, [tableId]);
  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 24);
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
  async function saveField(field: FieldSummary, nextType: FieldType, config: JsonValue) { if (nextType !== field.fieldType) { setPendingConversion({ field, name: field.name, nextType, config, preview: previewFieldConversion(data, field.id, nextType) }); return false; } try { await updateField(field.id, field.name, nextType, config); setEditorError(null); return true; } catch (error) { setEditorError(error instanceof Error ? error.message : "字段更新失败，请重试"); return false; } }
  async function renameField(field: FieldSummary, name: string) { try { await updateField(field.id, name, field.fieldType, field.config); } catch (error) { onError(error instanceof Error ? error.message : "字段重命名失败，请重试"); throw error; } }
  async function confirmConversion() { if (!pendingConversion) return; const pending = pendingConversion; try { await updateField(pending.field.id, pending.name, pending.nextType, pending.config); setPendingConversion(null); setEditorError(null); if (pending.field.id === activityFieldId && pending.nextType !== "select") setActivityFieldId(null); } catch (error) { setPendingConversion(null); setEditorError(error instanceof Error ? error.message : "字段转换失败，请重试"); } }
  async function confirmFieldDelete() { if (!pendingDelete) return; const pending = pendingDelete; setPendingDelete(null); await run(() => deleteField(pending.field.id), "字段删除失败"); if (pending.field.id === activityFieldId) setActivityFieldId(null); }
  async function confirmOptionDelete(mode: "delete" | "replace" | "clear", replacementId: string | null) { if (!pendingOptionDelete) return; const option = pendingOptionDelete.option; setPendingOptionDelete(null); await run(() => deleteOption(option.id, mode, replacementId), "选项删除失败"); }
  const orderedFields = viewLayout ? [...data.fields].sort((left, right) => viewLayout.fieldOrder.indexOf(left.id) - viewLayout.fieldOrder.indexOf(right.id)) : data.fields;
  function moveViewField(fieldId: string, delta: -1 | 1) { if (!viewLayout) return; const index = viewLayout.fieldOrder.indexOf(fieldId); const nextIndex = index + delta; if (index <= 0 || nextIndex <= 0 || nextIndex >= viewLayout.fieldOrder.length) return; const next = [...viewLayout.fieldOrder]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; viewLayout.onChange(next, viewLayout.visibleFieldIds); }
  function dropField(fieldId: string) { if (!viewLayout || !draggedFieldId || draggedFieldId === fieldId || !viewLayout.fieldOrder.includes(draggedFieldId) || !viewLayout.fieldOrder.includes(fieldId)) return; const next = [...viewLayout.fieldOrder]; const from = next.indexOf(draggedFieldId); const to = next.indexOf(fieldId); next.splice(from, 1); next.splice(to, 0, draggedFieldId); setDraggedFieldId(null); viewLayout.onChange(next, viewLayout.visibleFieldIds); }
  function toggleVisibility(fieldId: string) { if (!viewLayout) return; const visible = new Set(viewLayout.visibleFieldIds); if (visible.has(fieldId)) visible.delete(fieldId); else visible.add(fieldId); viewLayout.onChange(viewLayout.fieldOrder, viewLayout.fieldOrder.filter((id) => visible.has(id))); }

  function leaveEditor() { setEditorError(null); setSelectedField(null); restoreEditFocus(); }
  function closeManager(restoreFocus = true) { onClose(restoreFocus); if (restoreFocus) requestAnimationFrame(() => anchor?.focus()); }

  const manager = <section id="field-manager-popover" ref={dialogRef} style={position} className="morfra-field-manager-panel flex min-h-0 flex-col overflow-hidden rounded-(--r-lg) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) shadow-(--shadow-panel)" role="dialog" aria-modal="false" aria-labelledby="field-manager-title" onKeyDown={(event) => { if (event.key === "Escape" && !document.querySelector(".morfra-field-manager-panel [role='dialog'][aria-modal='true']")) { event.preventDefault(); selectedField ? leaveEditor() : closeManager(); } }}>
    {selectedField ? <FieldEditPage field={data.fields.find((field) => field.id === selectedField.id) ?? selectedField} error={editorError} onDirtyChange={setDraftDirty} onBack={leaveEditor} onSave={saveField} onCreateOption={(fieldId, name, color) => run(() => createOption(fieldId, name, color), "新增选项失败")} onUpdateOption={(option, name, color) => run(() => updateOption(option.id, name, color), "选项保存失败")} onReorderOption={(fieldId, optionIds) => run(() => reorderOptions(fieldId, optionIds), "选项排序失败")} onDeleteOption={async (option) => { const usage = await optionUsage(option.id); setPendingOptionDelete({ option, ...usage }); }} /> : <><header className="flex items-center justify-between border-b border-(--module-scope-border-subtle) px-3 py-2"><h2 id="field-manager-title" className="m-0 text-[13px] font-semibold">字段管理</h2><button type="button" className="rounded-(--r-sm) px-1.5 py-1 text-[11px] text-(--module-scope-text-secondary)" onClick={() => closeManager()}>关闭</button></header><div className="min-h-0 flex-1 overflow-y-auto p-2" onScroll={(event) => setListScrollTop(event.currentTarget.scrollTop)} ref={(node) => { if (node) node.scrollTop = listScrollTop; }}><section>{orderedFields.map((field) => <FieldEditor key={field.id} field={field} visible={viewLayout?.visibleFieldIds.includes(field.id) ?? true} onEdit={(next) => { lastEditFieldId.current = next.id; setSelectedField(next); setEditorError(null); }} onRename={renameField} onViewMove={moveViewField} onVisibilityChange={() => toggleVisibility(field.id)} onDragStart={setDraggedFieldId} onDragOver={(event) => event.preventDefault()} onDrop={dropField} onDelete={(field, restoreFocus) => setPendingDelete({ field, restoreFocus })} />)}</section></div><footer className="border-t border-(--module-scope-border-subtle) p-2">{fieldTypePickerOpen ? <FieldTypePicker inline onCreate={async (fieldType, name) => { await addField(fieldType, name); setFieldTypePickerOpen(false); }} onClose={() => setFieldTypePickerOpen(false)} /> : <button type="button" className="rounded-(--r-sm) bg-(--module-scope-action-base) px-2 py-1 text-[11px] text-(--module-scope-background-surface)" onClick={() => setFieldTypePickerOpen(true)}>＋ 新增字段</button>}</footer></>}
    {pendingDelete && <ConfirmDialog title={`删除“${pendingDelete.field.name}”？`} body={`字段值会被删除，所有视图中对它的显示、筛选、排序和分组引用会被清理；操作可撤销。${pendingDelete.field.id === activityFieldId ? "该字段是活动关联字段，确认后活动跟踪将停止；已有历史会保留。" : ""}`} confirmLabel="删除字段" onCancel={() => { const restoreFocus = pendingDelete.restoreFocus; setPendingDelete(null); requestAnimationFrame(restoreFocus); }} onConfirm={() => void confirmFieldDelete()} />}
    {pendingConversion && <FieldTypeConversionDialog preview={pendingConversion.preview} activityTrackingStops={pendingConversion.field.id === activityFieldId && pendingConversion.nextType !== "select"} onCancel={() => setPendingConversion(null)} onConfirm={() => void confirmConversion()} />}
    {pendingOptionDelete && <OptionDeleteDialog pending={pendingOptionDelete} options={data.fields.find((field) => field.id === pendingOptionDelete.option.fieldId)?.options ?? []} onCancel={() => setPendingOptionDelete(null)} onConfirm={confirmOptionDelete} />}
  </section>;
  return typeof document === "undefined" ? manager : createPortal(manager, document.body);
}

function OptionDeleteDialog({ pending, options, onCancel, onConfirm }: { pending: PendingOptionDelete; options: FieldOptionSummary[]; onCancel: () => void; onConfirm: (mode: "delete" | "replace" | "clear", replacementId: string | null) => void }) {
  const [mode, setMode] = useState<"delete" | "replace" | "clear">(pending.recordCount === 0 && pending.viewRuleCount === 0 ? "delete" : "clear");
  const [replacementId, setReplacementId] = useState(options.find((option) => option.id !== pending.option.id)?.id ?? "");
  return <div className="fixed inset-0 z-70 flex items-center justify-center bg-(--overlay-scrim)" role="dialog" aria-modal="true"><div className="w-[min(92vw,460px)] rounded-(--r-lg) bg-(--module-scope-background-surface) p-5 shadow-(--shadow-dialog)"><h2 className="m-0 text-[15px] font-semibold">删除选项“{pending.option.name}”</h2><p className="mt-2 text-[12px] text-(--module-scope-text-secondary)">{pending.recordCount === 0 && pending.viewRuleCount === 0 ? "该选项没有记录或视图引用，可以安全删除。" : `将影响 ${pending.recordCount} 条记录和 ${pending.viewRuleCount} 条视图规则。请选择处理方式。`}</p>{pending.recordCount === 0 && pending.viewRuleCount === 0 ? <label className="mt-4 flex items-center gap-2 text-[12px]"><input type="radio" checked readOnly />直接删除</label> : <><label className="mt-4 flex items-center gap-2 text-[12px]"><input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />替换为<select disabled={mode !== "replace"} value={replacementId} onChange={(event) => setReplacementId(event.target.value)} className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) px-2 py-1">{options.filter((option) => option.id !== pending.option.id).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label className="mt-2 flex items-center gap-2 text-[12px]"><input type="radio" checked={mode === "clear"} onChange={() => setMode("clear")} />清空该选项</label></>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-(--r-sm) border border-(--module-scope-border-strong) px-3 py-1.5 text-[12px]" onClick={onCancel}>取消</button><button type="button" className="rounded-(--r-sm) bg-(--module-scope-feedback-danger) px-3 py-1.5 text-[12px] text-(--module-scope-background-surface)" onClick={() => onConfirm(mode, mode === "replace" ? replacementId : null)}>确认删除</button></div></div></div>;
}

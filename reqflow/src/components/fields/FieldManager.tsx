import { useEffect, useState } from "react";
import type { FieldOptionSummary, FieldSummary, FieldType, JsonValue, TableDataSnapshot } from "../../types/domain";
import { previewFieldConversion, type ConversionPreview } from "../../lib/fields/valueConversion";
import { useTableDataStore } from "../../stores/tableDataStore";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { FieldEditor } from "./FieldEditor";
import { FieldTypeConversionDialog } from "./FieldTypeConversionDialog";
import { FieldTypePicker } from "./FieldTypePicker";
import { getStorageActivityBinding } from "../../lib/ipc/storageClient";

interface FieldManagerProps {
  tableId: string;
  data: TableDataSnapshot;
  onClose: () => void;
  onError: (message: string) => void;
}

interface PendingConversion {
  field: FieldSummary;
  name: string;
  nextType: FieldType;
  config: JsonValue;
  preview: ConversionPreview;
}

interface PendingOptionDelete {
  option: FieldOptionSummary;
  recordCount: number;
  viewRuleCount: number;
}

export function FieldManager({ tableId, data, onClose, onError }: FieldManagerProps) {
  const createField = useTableDataStore((state) => state.createField);
  const updateField = useTableDataStore((state) => state.updateField);
  const deleteField = useTableDataStore((state) => state.deleteField);
  const reorderFields = useTableDataStore((state) => state.reorderFields);
  const createOption = useTableDataStore((state) => state.createOption);
  const updateOption = useTableDataStore((state) => state.updateOption);
  const reorderOptions = useTableDataStore((state) => state.reorderOptions);
  const optionUsage = useTableDataStore((state) => state.optionUsage);
  const deleteOption = useTableDataStore((state) => state.deleteOption);
  const [fieldTypePickerOpen, setFieldTypePickerOpen] = useState(false);
  const [createdFieldId, setCreatedFieldId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FieldSummary | null>(null);
  const [pendingOptionDelete, setPendingOptionDelete] = useState<PendingOptionDelete | null>(null);
  const [pendingConversion, setPendingConversion] = useState<PendingConversion | null>(null);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [activityFieldId, setActivityFieldId] = useState<string | null>(null);

  useEffect(() => { void getStorageActivityBinding(tableId).then((binding) => setActivityFieldId(binding.fieldId)).catch(() => setActivityFieldId(null)); }, [tableId]);

  async function run(action: () => Promise<unknown>, message: string) { try { await action(); } catch (error) { onError(error instanceof Error ? error.message : message); } }
  async function addField(fieldType: FieldType, name: string) { const knownIds = new Set(data.fields.map((field) => field.id)); const snapshot = await createField(tableId, name, fieldType, {}); const created = snapshot.fields.find((field) => !knownIds.has(field.id)); if (!created) throw new Error("字段创建结果缺失"); setCreatedFieldId(created.id); }
  async function saveField(field: FieldSummary, name: string, nextType: FieldType, config: JsonValue) { if (nextType !== field.fieldType) { setPendingConversion({ field, name, nextType, config, preview: previewFieldConversion(data, field.id, nextType) }); return; } await run(() => updateField(field.id, name, nextType, config), "字段保存失败"); }
  async function confirmConversion() { if (!pendingConversion) return; const pending = pendingConversion; setPendingConversion(null); await run(() => updateField(pending.field.id, pending.name, pending.nextType, pending.config), "字段转换失败"); if (pending.field.id === activityFieldId && pending.nextType !== "select") setActivityFieldId(null); }
  async function confirmFieldDelete() { if (!pendingDelete) return; const field = pendingDelete; setPendingDelete(null); await run(() => deleteField(field.id), "字段删除失败"); if (field.id === activityFieldId) setActivityFieldId(null); }
  async function confirmOptionDelete(mode: "delete" | "replace" | "clear", replacementId: string | null) { if (!pendingOptionDelete) return; const option = pendingOptionDelete.option; setPendingOptionDelete(null); await run(() => deleteOption(option.id, mode, replacementId), "选项删除失败"); }
  async function moveField(fieldId: string, delta: -1 | 1) { const index = data.fields.findIndex((field) => field.id === fieldId); const nextIndex = index + delta; if (index <= 0 || nextIndex <= 0 || nextIndex >= data.fields.length) return; const next = [...data.fields]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; await run(() => reorderFields(tableId, next.map((item) => item.id)), "字段排序失败"); }
  async function dropField(fieldId: string) { if (!draggedFieldId || draggedFieldId === fieldId) return; const next = [...data.fields]; const from = next.findIndex((field) => field.id === draggedFieldId); const to = next.findIndex((field) => field.id === fieldId); if (from <= 0 || to <= 0) return; const [item] = next.splice(from, 1); next.splice(to, 0, item); setDraggedFieldId(null); await run(() => reorderFields(tableId, next.map((field) => field.id)), "字段排序失败"); }

  return <div className="fixed inset-0 z-60 flex items-stretch justify-end bg-(--overlay-scrim)" role="dialog" aria-modal="true" aria-labelledby="field-manager-title"><section className="flex h-full w-[min(94vw,620px)] min-w-0 flex-col bg-(--module-scope-background-surface) shadow-(--shadow-panel)">
    <header className="flex items-center justify-between border-b border-(--module-scope-border-subtle) px-5 py-4"><div><h2 id="field-manager-title" className="m-0 text-[16px] font-semibold text-(--module-scope-text-primary)">字段管理</h2><p className="m-0 mt-1 text-[11px] text-(--module-scope-text-tertiary)">表级结构会同步影响当前表的所有视图</p></div><button type="button" className="rounded-(--r-sm) border border-(--module-scope-border-subtle) px-2 py-1 text-[12px]" onClick={onClose}>关闭</button></header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4"><section className="relative mb-4 rounded-(--r-sm) border border-(--module-scope-border-subtle) p-3"><div className="mb-2 text-[11px] font-medium text-(--module-scope-text-secondary)">新建字段</div>{fieldTypePickerOpen ? <FieldTypePicker inline onCreate={async (fieldType, name) => { await addField(fieldType, name); setFieldTypePickerOpen(false); }} onClose={() => setFieldTypePickerOpen(false)} /> : <button type="button" className="rounded-(--r-sm) bg-(--module-scope-action-base) px-3 py-1.5 text-[12px] text-(--module-scope-background-surface)" onClick={() => setFieldTypePickerOpen(true)}>选择字段类型</button>}</section>
      <section className="overflow-hidden rounded-(--r-sm) border border-(--module-scope-border-subtle)">{data.fields.map((field, index) => <FieldEditor key={field.id} field={field} autoEdit={field.id === createdFieldId} canMoveUp={!field.isTitle && index > 1} canMoveDown={!field.isTitle && index < data.fields.length - 1} onReorder={moveField} onDragStart={setDraggedFieldId} onDragOver={(event) => event.preventDefault()} onDrop={(fieldId) => void dropField(fieldId)} onSave={async (...args) => { await saveField(...args); if (field.id === createdFieldId) setCreatedFieldId(null); }} onDelete={setPendingDelete} onCreateOption={(fieldId, name, color) => run(() => createOption(fieldId, name, color), "新增选项失败")} onUpdateOption={(option, name, color) => run(() => updateOption(option.id, name, color), "选项保存失败")} onReorderOption={(fieldId, optionIds) => run(() => reorderOptions(fieldId, optionIds), "选项排序失败")} onDeleteOption={async (option) => { const usage = await optionUsage(option.id); setPendingOptionDelete({ option, ...usage }); }} />)}</section>
    </div>
    {pendingDelete && <ConfirmDialog title={`删除“${pendingDelete.name}”？`} body={`字段值会被删除，所有视图中对它的显示、筛选、排序和分组引用会被清理；操作可撤销。${pendingDelete.id === activityFieldId ? "该字段是活动关联字段，确认后活动跟踪将停止；已有历史会保留。" : ""}`} confirmLabel="删除字段" onCancel={() => setPendingDelete(null)} onConfirm={() => void confirmFieldDelete()} />}
    {pendingConversion && <FieldTypeConversionDialog preview={pendingConversion.preview} activityTrackingStops={pendingConversion.field.id === activityFieldId && pendingConversion.nextType !== "select"} onCancel={() => setPendingConversion(null)} onConfirm={() => void confirmConversion()} />}
    {pendingOptionDelete && <OptionDeleteDialog pending={pendingOptionDelete} options={pendingOptionDelete.option ? data.fields.find((field) => field.id === pendingOptionDelete.option.fieldId)?.options ?? [] : []} onCancel={() => setPendingOptionDelete(null)} onConfirm={confirmOptionDelete} />}
  </section></div>;
}

function OptionDeleteDialog({ pending, options, onCancel, onConfirm }: { pending: PendingOptionDelete; options: FieldOptionSummary[]; onCancel: () => void; onConfirm: (mode: "delete" | "replace" | "clear", replacementId: string | null) => void }) {
  const [mode, setMode] = useState<"delete" | "replace" | "clear">(pending.recordCount === 0 && pending.viewRuleCount === 0 ? "delete" : "clear");
  const [replacementId, setReplacementId] = useState(options.find((option) => option.id !== pending.option.id)?.id ?? "");
  return <div className="fixed inset-0 z-70 flex items-center justify-center bg-(--overlay-scrim)" role="dialog" aria-modal="true"><div className="w-[min(92vw,460px)] rounded-(--r-lg) bg-(--module-scope-background-surface) p-5 shadow-(--shadow-dialog)"><h2 className="m-0 text-[15px] font-semibold">删除选项“{pending.option.name}”</h2><p className="mt-2 text-[12px] text-(--module-scope-text-secondary)">{pending.recordCount === 0 && pending.viewRuleCount === 0 ? "该选项没有记录或视图引用，可以安全删除。" : `将影响 ${pending.recordCount} 条记录和 ${pending.viewRuleCount} 条视图规则。请选择处理方式。`}</p>{pending.recordCount === 0 && pending.viewRuleCount === 0 ? <label className="mt-4 flex items-center gap-2 text-[12px]"><input type="radio" checked readOnly />直接删除</label> : <><label className="mt-4 flex items-center gap-2 text-[12px]"><input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />替换为<select disabled={mode !== "replace"} value={replacementId} onChange={(event) => setReplacementId(event.target.value)} className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) px-2 py-1">{options.filter((option) => option.id !== pending.option.id).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label className="mt-2 flex items-center gap-2 text-[12px]"><input type="radio" checked={mode === "clear"} onChange={() => setMode("clear")} />清空该选项</label></>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-(--r-sm) border border-(--module-scope-border-strong) px-3 py-1.5 text-[12px]" onClick={onCancel}>取消</button><button type="button" className="rounded-(--r-sm) bg-(--module-scope-feedback-danger) px-3 py-1.5 text-[12px] text-(--module-scope-background-surface)" onClick={() => onConfirm(mode, mode === "replace" ? replacementId : null)}>确认删除</button></div></div></div>;
}

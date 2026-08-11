import { useEffect, useState } from "react";
import type { FieldSummary } from "../../types/domain";
import { getStorageActivityBinding, updateStorageActivityBinding } from "../../lib/ipc/storageClient";

interface ActivityFieldBindingProps { tableId: string; fields: FieldSummary[]; onClose: () => void; }

export function ActivityFieldBinding({ tableId, fields, onClose }: ActivityFieldBindingProps) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const options = fields.filter((field) => field.fieldType === "select" && !field.isTitle);
  useEffect(() => { void getStorageActivityBinding(tableId).then((binding) => setValue(binding.fieldId)).catch(() => setError("活动关联读取失败，请重试")); }, [tableId]);
  async function save(next: string | null) { setError(null); try { setValue((await updateStorageActivityBinding(tableId, next)).fieldId); } catch { setError("活动关联保存失败，原配置未变更"); } }
  return <section className="fixed inset-0 z-60 flex items-start justify-end bg-(--overlay-scrim)" role="dialog" aria-modal="true" aria-label="活动字段关联"><div className="m-4 w-[min(92vw,380px)] rounded-(--r-lg) bg-(--module-scope-background-surface) p-5 shadow-(--shadow-dialog)"><h2 className="m-0 text-[15px] font-semibold">活动字段关联</h2><p className="mt-1 text-[12px] text-(--module-scope-text-tertiary)">选择一个普通单选字段。以后该字段的有效变化会写入记录活动；历史不受改绑影响。</p><label className="mt-4 block text-[12px]">关联字段<select className="mt-1 w-full rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-1.5 text-(--module-scope-text-primary) outline-none focus:border-(--module-scope-action-base) focus:ring-2 focus:ring-(--module-scope-action-soft)" value={value ?? ""} onChange={(event) => void save(event.target.value || null)}><option value="">未关联</option>{options.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>{options.length === 0 && <p className="text-[12px] text-(--module-scope-feedback-danger)">当前表没有可关联的普通单选字段。</p>}{error && <p role="alert" className="text-[12px] text-(--module-scope-feedback-danger)">{error}</p>}<div className="mt-5 flex justify-end"><button type="button" onClick={onClose}>完成</button></div></div></section>;
}

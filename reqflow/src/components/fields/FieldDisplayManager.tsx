import type { FieldSummary } from "../../types/domain";

interface FieldDisplayManagerProps {
  fields: FieldSummary[];
  selectedIds: string[];
  onChange: (fieldIds: string[]) => void;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function FieldDisplayManager({ fields, selectedIds, onChange, onClose, title = "字段显示", description = "只影响当前视图，不改表级字段结构。" }: FieldDisplayManagerProps) {
  const ordered = selectedIds.map((id) => fields.find((field) => field.id === id)).filter((field): field is FieldSummary => Boolean(field));
  const hidden = fields.filter((field) => !selectedIds.includes(field.id));
  function toggle(field: FieldSummary) { if (field.isTitle) return; onChange(selectedIds.includes(field.id) ? selectedIds.filter((id) => id !== field.id) : [...selectedIds, field.id]); }
  function move(field: FieldSummary, delta: -1 | 1) { const index = selectedIds.indexOf(field.id); const nextIndex = index + delta; if (index < 0 || nextIndex < 0 || nextIndex >= selectedIds.length || fields.find((item) => item.id === selectedIds[nextIndex])?.isTitle) return; const next = [...selectedIds]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; onChange(next); }
  return <div className="fixed inset-0 z-60 flex items-start justify-end bg-(--overlay-scrim)" role="dialog" aria-modal="true" aria-labelledby="field-display-title"><section className="m-4 w-[min(92vw,360px)] rounded-(--r-lg) bg-(--module-scope-background-surface) p-5 shadow-(--shadow-dialog)"><header className="flex items-start justify-between"><div><h2 id="field-display-title" className="m-0 text-[15px] font-semibold text-(--module-scope-text-primary)">{title}</h2><p className="m-0 mt-1 text-[11px] text-(--module-scope-text-tertiary)">{description}</p></div><button type="button" className="text-[12px] text-(--module-scope-text-tertiary)" onClick={onClose}>关闭</button></header><div className="mt-4 space-y-1">{ordered.map((field, index) => <div key={field.id} className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked onChange={() => toggle(field)} disabled={field.isTitle} /><span className="min-w-0 flex-1 truncate">{field.name}{field.isTitle ? " · 主标题" : ""}</span><button type="button" aria-label={`上移${field.name}`} disabled={field.isTitle || index === 0} className="disabled:opacity-40" onClick={() => move(field, -1)}>↑</button><button type="button" aria-label={`下移${field.name}`} disabled={field.isTitle || index === ordered.length - 1} className="disabled:opacity-40" onClick={() => move(field, 1)}>↓</button></div>)}{hidden.map((field) => <label key={field.id} className="flex items-center gap-2 text-[12px] text-(--module-scope-text-secondary)"><input type="checkbox" checked={false} onChange={() => toggle(field)} /><span>{field.name}</span></label>)}</div><div className="mt-5 flex justify-end"><button type="button" className="rounded-(--r-sm) bg-(--module-scope-action-base) px-3 py-1.5 text-[12px] text-(--module-scope-background-surface)" onClick={onClose}>完成</button></div></section></div>;
}

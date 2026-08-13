import { useEffect, useRef, useState } from "react";
import type { FieldSummary } from "../../../types/domain";
import { isSortableField } from "../../../lib/table/viewPipeline";
import { fieldTypeIcon, move, newId, Panel, type PanelProps, replace } from "./viewToolShared";

export function SortPanel({ fields, config, onChange, onClose, visibleFieldIds }: PanelProps & { visibleFieldIds?: string[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);
  const directionRefs = useRef<Record<string, HTMLSelectElement | null>>({});
  const addRef = useRef<HTMLButtonElement>(null);
  const visible = new Set(visibleFieldIds ?? fields.map((field) => field.id));
  const selected = new Set(config.sorts.map((sort) => sort.fieldId));
  const available = fields.filter((field) => isSortableField(field) && !selected.has(field.id));
  const add = (field: FieldSummary) => { const rule = { id: newId(), fieldId: field.id, direction: "asc" as const }; onChange({ ...config, sorts: [...config.sorts, rule] }); setPickerOpen(false); requestAnimationFrame(() => directionRefs.current[rule.id]?.focus()); };
  const remove = (index: number) => { const next = config.sorts.filter((_, item) => item !== index); onChange({ ...config, sorts: next }); requestAnimationFrame(() => { const adjacent = next[Math.min(index, next.length - 1)]; if (adjacent) directionRefs.current[adjacent.id]?.focus(); else addRef.current?.focus(); }); };
  return <Panel title="排序" onClose={onClose}>
    {config.sorts.map((sort, index) => { const field = fields.find((item) => item.id === sort.fieldId); if (!field) return null; return <section draggable className="morfra-sort-rule" key={sort.id} onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged !== null) onChange({ ...config, sorts: move(config.sorts, dragged, index) }); setDragged(null); }}>
      <span className="morfra-sort-grip" aria-hidden="true">⠿</span><span aria-hidden="true">{fieldTypeIcon(field)}</span><strong>{field.name}</strong>
      <select ref={(node) => { directionRefs.current[sort.id] = node; }} aria-label={`${field.name} 排序方向`} value={sort.direction} onChange={(event) => onChange({ ...config, sorts: replace(config.sorts, index, { ...sort, direction: event.target.value === "desc" ? "desc" : "asc" }) })}>{directionOptions(field)}</select>
      <button type="button" aria-label={`上移 ${field.name} 排序`} disabled={index === 0} onClick={() => onChange({ ...config, sorts: move(config.sorts, index, index - 1) })}>↑</button><button type="button" aria-label={`下移 ${field.name} 排序`} disabled={index === config.sorts.length - 1} onClick={() => onChange({ ...config, sorts: move(config.sorts, index, index + 1) })}>↓</button><button type="button" aria-label={`删除 ${field.name} 排序`} onClick={() => remove(index)}>×</button>
    </section>; })}
    {pickerOpen ? <SortPicker fields={available} visible={visible} onChoose={add} onBack={() => { setPickerOpen(false); requestAnimationFrame(() => addRef.current?.focus()); }} /> : <button ref={addRef} type="button" className="morfra-filter-add" onClick={() => setPickerOpen(true)} disabled={!available.length}>＋ 添加排序字段</button>}
  </Panel>;
}

function SortPicker({ fields, visible, onChoose, onBack }: { fields: FieldSummary[]; visible: Set<string>; onChoose: (field: FieldSummary) => void; onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null); useEffect(() => { ref.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, []);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])]; const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") { event.preventDefault(); onBack(); return; }
    if (!items.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[next]?.focus();
  };
  return <div ref={ref} className="morfra-filter-field-picker" role="listbox" aria-label="选择排序字段" onKeyDown={onKeyDown}>
    {fields.map((field) => <button key={field.id} type="button" role="option" aria-selected="false" onClick={() => onChoose(field)}><span aria-hidden="true">{fieldTypeIcon(field)}</span><span>{field.name}</span>{!visible.has(field.id) && <em>已隐藏</em>}</button>)}
  </div>;
}

function directionOptions(field: FieldSummary) { const labels = field.fieldType === "checkbox" ? ["未勾选优先", "已勾选优先"] : ["select", "multi_select"].includes(field.fieldType) ? ["选项顺序", "选项倒序"] : ["number", "progress", "auto_number"].includes(field.fieldType) ? ["从小到大", "从大到小"] : ["date", "created_time", "updated_time"].includes(field.fieldType) ? ["从早到晚", "从晚到早"] : ["A → Z", "Z → A"]; return <><option value="asc">{labels[0]}</option><option value="desc">{labels[1]}</option></>; }

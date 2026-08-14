import { useEffect, useRef, useState } from "react";
import { isGroupable } from "../../../lib/table/groupProjection";
import type { FieldSummary } from "../../../types/domain";
import { fieldTypeIcon, Panel, type PanelProps } from "./viewToolShared";

export function GroupPanel({ fields, config, onChange, onClose, visibleFieldIds }: PanelProps & { visibleFieldIds?: string[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const directionRef = useRef<HTMLSelectElement>(null);
  const visible = new Set(visibleFieldIds ?? fields.map((field) => field.id));
  const groupable = fields.filter(isGroupable);
  const current = groupable.find((field) => field.id === config.group.fieldId);
  useEffect(() => { if (!current && !pickerOpen) addRef.current?.focus(); }, [current, pickerOpen]);
  const update = (fieldId: string | null, direction = config.group.direction) => onChange({ ...config, group: { fieldId, direction, collapsedKeys: [] } });
  const choose = (field: FieldSummary) => { setPickerOpen(false); update(field.id); requestAnimationFrame(() => directionRef.current?.focus()); };
  const clear = () => { update(null, "asc"); requestAnimationFrame(() => addRef.current?.focus()); };
  return <Panel title="分组" onClose={onClose}>
    {!current && (pickerOpen
      ? <GroupFieldPicker fields={groupable} visible={visible} onChoose={choose} onBack={() => { setPickerOpen(false); requestAnimationFrame(() => addRef.current?.focus()); }} />
      : <button ref={addRef} type="button" className="morfra-filter-add" onClick={() => setPickerOpen(true)}>＋ 添加分组字段</button>)}
    {current && <section className="morfra-group-rule" aria-label={`按 ${current.name} 分组`}>
      <div><span aria-hidden="true">{fieldTypeIcon(current)}</span><strong>{current.name}</strong><button type="button" aria-label="更换分组字段" onClick={() => setPickerOpen(true)}>更换</button></div>
      <label>组序<select ref={directionRef} aria-label={`${current.name} 分组方向`} value={config.group.direction} onChange={(event) => update(current.id, event.target.value === "desc" ? "desc" : "asc")}>{directionOptions(current)}</select></label>
      <div className="morfra-view-tool-row"><button type="button" onClick={() => onChange({ ...config, group: { ...config.group, collapsedKeys: [] } })}>全部展开</button><button type="button" onClick={() => onChange({ ...config, group: { ...config.group, collapsedKeys: ["__all__"] } })}>全部收起</button><button type="button" className="morfra-group-clear" onClick={clear}>清除分组</button></div>
      {pickerOpen && <GroupFieldPicker fields={groupable.filter((field) => field.id !== current.id)} visible={visible} onChoose={choose} onBack={() => { setPickerOpen(false); requestAnimationFrame(() => directionRef.current?.focus()); }} />}
    </section>}
  </Panel>;
}

function GroupFieldPicker({ fields, visible, onChoose, onBack }: { fields: FieldSummary[]; visible: Set<string>; onChoose: (field: FieldSummary) => void; onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, []);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])]; const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") { event.preventDefault(); onBack(); return; }
    if (!items.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[next]?.focus();
  };
  return <div ref={ref} className="morfra-filter-field-picker" role="listbox" aria-label="选择分组字段" onKeyDown={onKeyDown}>
    {fields.map((field) => <button key={field.id} type="button" role="option" aria-selected="false" onClick={() => onChoose(field)}><span aria-hidden="true">{fieldTypeIcon(field)}</span><span>{field.name}</span>{!visible.has(field.id) && <em>已隐藏</em>}</button>)}
  </div>;
}

function directionOptions(field: FieldSummary) { const labels = field.fieldType === "checkbox" ? ["未勾选在前", "已勾选在前"] : field.fieldType === "select" ? ["选项顺序", "选项倒序"] : ["number", "progress"].includes(field.fieldType) ? ["从小到大", "从大到小"] : ["date", "created_time", "updated_time"].includes(field.fieldType) ? ["从早到晚", "从晚到早"] : ["A → Z", "Z → A"]; return <><option value="asc">{labels[0]}</option><option value="desc">{labels[1]}</option></>; }

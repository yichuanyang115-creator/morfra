import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { FieldSummary } from "../../../types/domain";
import { filterOperatorsFor, isCompleteFilter, type ConditionalColorRule, type FilterOperator } from "../../../lib/table/viewPipeline";
import { fieldTypeIcon, move, newId, operatorLabel, Panel, type PanelProps, replace } from "./viewToolShared";

const COLORS: Array<{ value: ConditionalColorRule["color"]; label: string }> = [
  ["gray", "灰色"], ["blue", "蓝色"], ["cyan", "青色"], ["green", "绿色"], ["yellow", "黄色"], ["orange", "橙色"], ["red", "红色"], ["pink", "粉色"], ["purple", "紫色"],
].flatMap(([family, name]) => [
  { value: `${family}-light` as ConditionalColorRule["color"], label: `${name} · 浅色` },
  { value: family as ConditionalColorRule["color"], label: name },
  { value: `${family}-strong` as ConditionalColorRule["color"], label: `${name} · 重色` },
]);

export function ConditionalColorPanel({ fields, config, onChange, onClose, visibleFieldIds, anchor }: PanelProps & { visibleFieldIds?: string[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ConditionalColorRule[]>([]);
  const [dragged, setDragged] = useState<number | null>(null);
  const operatorRefs = useRef<Record<string, HTMLSelectElement | null>>({});
  const addRef = useRef<HTMLButtonElement>(null);
  const visible = new Set(visibleFieldIds ?? fields.map((field) => field.id));
  const configurable = fields.filter((field) => filterOperatorsFor(field).length > 0);
  const draftIds = new Set(drafts.map((rule) => rule.id));
  const rules = [...config.conditionalColors.filter((rule) => !draftIds.has(rule.id)), ...drafts];
  useEffect(() => {
    const local = new Map(drafts.map((rule) => [rule.id, rule]));
    const completeDrafts = drafts.filter((rule) => isCompleteFilter(rule, fields));
    const next = [...config.conditionalColors.flatMap((rule) => {
      const replacement = local.get(rule.id);
      return replacement ? (isCompleteFilter(replacement, fields) ? [replacement] : []) : [rule];
    }), ...completeDrafts.filter((rule) => !config.conditionalColors.some((item) => item.id === rule.id))];
    const timer = window.setTimeout(() => { if (JSON.stringify(next) !== JSON.stringify(config.conditionalColors)) onChange({ ...config, conditionalColors: next }); }, 80);
    return () => window.clearTimeout(timer);
  }, [config, drafts, fields, onChange]);
  useEffect(() => { if (!rules.length && !pickerOpen) addRef.current?.focus(); }, [pickerOpen, rules.length]);
  const choose = (field: FieldSummary) => {
    if (pickerFor && pickerFor !== "new") {
      const current = rules.find((rule) => rule.id === pickerFor);
      if (current) change(current, { ...current, fieldId: field.id, operator: filterOperatorsFor(field)[0] ?? "equals", value: "" });
      setPickerFor(null); setPickerOpen(false); requestAnimationFrame(() => operatorRefs.current[pickerFor]?.focus()); return;
    }
    const rule: ConditionalColorRule = { id: newId(), fieldId: field.id, operator: filterOperatorsFor(field)[0] ?? "equals", value: "", color: "blue", enabled: true };
    setDrafts((current) => [...current, rule]); setPickerFor(null); setPickerOpen(false); requestAnimationFrame(() => operatorRefs.current[rule.id]?.focus());
  };
  const change = (rule: ConditionalColorRule, next: ConditionalColorRule) => {
    setDrafts((current) => current.some((item) => item.id === rule.id) ? replace(current, current.findIndex((item) => item.id === rule.id), next) : [...current, next]);
  };
  const remove = (rule: ConditionalColorRule) => {
    const persistedIndex = config.conditionalColors.findIndex((item) => item.id === rule.id);
    if (persistedIndex >= 0) onChange({ ...config, conditionalColors: config.conditionalColors.filter((item) => item.id !== rule.id) });
    setDrafts((current) => current.filter((item) => item.id !== rule.id));
    requestAnimationFrame(() => { const adjacent = rules[rules.indexOf(rule) + 1] ?? rules[rules.indexOf(rule) - 1]; if (adjacent) operatorRefs.current[adjacent.id]?.focus(); else addRef.current?.focus(); });
  };
  return <Panel title="条件填色" onClose={onClose} wide anchor={anchor}>
    {rules.map((rule, index) => { const field = configurable.find((item) => item.id === rule.fieldId); return field && <ColorRuleRow key={rule.id} index={index} field={field} rule={rule} operatorRef={(node) => { operatorRefs.current[rule.id] = node; }} onChange={(next) => change(rule, next)} onChangeField={() => { setPickerFor(rule.id); setPickerOpen(true); }} onRemove={() => remove(rule)} draggable={config.conditionalColors.some((item) => item.id === rule.id)} onDragStart={() => setDragged(index)} onDrop={() => { if (dragged !== null) onChange({ ...config, conditionalColors: move(config.conditionalColors, dragged, index) }); setDragged(null); }} />; })}
    {pickerOpen ? <ColorFieldPicker fields={configurable} visible={visible} onChoose={choose} onBack={() => { setPickerOpen(false); setPickerFor(null); requestAnimationFrame(() => (pickerFor && pickerFor !== "new" ? operatorRefs.current[pickerFor] : addRef.current)?.focus()); }} /> : <button ref={addRef} type="button" className="morfra-filter-add morfra-color-add" onClick={() => { setPickerFor("new"); setPickerOpen(true); }}>＋ 添加规则</button>}
  </Panel>;
}

function ColorRuleRow({ index, field, rule, operatorRef, onChange, onChangeField, onRemove, draggable, onDragStart, onDrop }: { index: number; field: FieldSummary; rule: ConditionalColorRule; operatorRef: (node: HTMLSelectElement | null) => void; onChange: (rule: ConditionalColorRule) => void; onChangeField: () => void; onRemove: () => void; draggable: boolean; onDragStart: () => void; onDrop: () => void }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const colorRef = useRef<HTMLButtonElement>(null);
  const [palettePosition, setPalettePosition] = useState<CSSProperties>();
  const noValue = ["isEmpty", "isNotEmpty", "isChecked", "isUnchecked"].includes(rule.operator);
  useLayoutEffect(() => {
    if (!paletteOpen) return;
    const place = () => {
      const rect = colorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 190; const height = 70;
      const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
      const top = rect.bottom + height + 8 > window.innerHeight ? Math.max(12, rect.top - height - 8) : rect.bottom + 8;
      setPalettePosition({ position: "fixed", zIndex: 1001, left, top });
    };
    place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [paletteOpen]);
  const palette = paletteOpen && typeof document !== "undefined" ? createPortal(<div className="morfra-color-palette" style={palettePosition} role="listbox" aria-label="选择填色颜色" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setPaletteOpen(false); requestAnimationFrame(() => colorRef.current?.focus()); } }}>{COLORS.map((color) => <button key={color.value} type="button" role="option" aria-label={color.label} aria-selected={rule.color === color.value} className={`color-${color.value}`} onClick={() => { onChange({ ...rule, color: color.value }); setPaletteOpen(false); requestAnimationFrame(() => colorRef.current?.focus()); }}><span aria-hidden="true">{rule.color === color.value ? "✓" : ""}</span></button>)}</div>, document.body) : null;
  return <section draggable={draggable} className="morfra-color-rule" aria-label={`${field.name} 条件填色规则`} onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <span className="morfra-color-priority" aria-label={`优先级 ${index + 1}`}>#{index + 1}</span>
    <button type="button" className="morfra-color-field" aria-label={`更换 ${field.name} 填色字段`} onClick={onChangeField}><span aria-hidden="true">{fieldTypeIcon(field)}</span><span>{field.name}</span></button>
    <select ref={operatorRef} aria-label={`${field.name} 填色运算符`} value={rule.operator} onChange={(event) => { const operator = event.target.value as FilterOperator; onChange({ ...rule, operator, value: ["isEmpty", "isNotEmpty", "isChecked", "isUnchecked"].includes(operator) ? undefined : rule.value }); }}>{filterOperatorsFor(field).map((operator) => <option key={operator} value={operator}>{operatorLabel(operator, field)}</option>)}</select>
    <span className="morfra-color-value">{!noValue && <ColorValueInput key={`${field.id}:${rule.operator}`} field={field} rule={rule} onCommit={(value) => onChange({ ...rule, value })} />}</span>
    <span className="morfra-color-arrow" aria-hidden="true">→</span>
    <span className="morfra-color-picker"><button ref={colorRef} type="button" className={`morfra-color-swatch color-${rule.color}`} aria-expanded={paletteOpen} aria-haspopup="listbox" aria-label={`填色：${COLORS.find((item) => item.value === rule.color)?.label ?? rule.color}`} onClick={() => setPaletteOpen((current) => !current)} />{palette}</span>
    <button type="button" className="morfra-color-remove" aria-label={`删除 ${field.name} 填色规则`} onClick={onRemove}>×</button>
  </section>;
}

function ColorValueInput({ field, rule, onCommit }: { field: FieldSummary; rule: ConditionalColorRule; onCommit: (value: ConditionalColorRule["value"]) => void }) {
  const label = `${field.name} 填色值`;
  if (["select", "multi_select"].includes(field.fieldType)) return <select aria-label={label} value={String(rule.value ?? "")} onChange={(event) => onCommit(event.target.value)}><option value="">请选择</option>{field.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>;
  const type = ["number", "progress", "auto_number"].includes(field.fieldType) ? "number" : ["date", "created_time", "updated_time"].includes(field.fieldType) ? "date" : "text";
  return <input type={type} aria-label={label} defaultValue={String(rule.value ?? "")} onBlur={(event) => onCommit(event.target.value)} />;
}

function ColorFieldPicker({ fields, visible, onChoose, onBack }: { fields: FieldSummary[]; visible: Set<string>; onChoose: (field: FieldSummary) => void; onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null); useEffect(() => { ref.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, []);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => { const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])]; const index = items.indexOf(document.activeElement as HTMLButtonElement); if (event.key === "Escape") { event.preventDefault(); onBack(); return; } if (!items.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[next]?.focus(); };
  return <div ref={ref} className="morfra-filter-field-picker" role="listbox" aria-label="选择填色字段" onKeyDown={onKeyDown}>{fields.map((field) => <button key={field.id} type="button" role="option" aria-selected="false" onClick={() => onChoose(field)}><span aria-hidden="true">{fieldTypeIcon(field)}</span><span>{field.name}</span>{!visible.has(field.id) && <em>已隐藏</em>}</button>)}</div>;
}

import { useEffect, useRef, useState } from "react";
import type { FieldSummary, JsonValue } from "../../../types/domain";
import { filterOperatorsFor, isCompleteFilter, type FilterOperator, type ViewFilter } from "../../../lib/table/viewPipeline";
import { ConditionValue, fieldTypeIcon, newId, operatorLabel, Panel, type PanelProps, replace } from "./viewToolShared";

type DraftFilter = ViewFilter & { expanded: boolean };

export function FilterPanel({ fields, config, onChange, onClose, visibleFieldIds }: PanelProps & { visibleFieldIds?: string[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftFilter[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(config.filters.filter((filter) => !isCompleteFilter(filter, fields)).map((filter) => filter.id)));
  const operatorRefs = useRef<Record<string, HTMLSelectElement | null>>({});
  const visibleIds = new Set(visibleFieldIds ?? fields.map((field) => field.id));
  const persisted = config.filters.map((filter) => ({ ...filter, expanded: expanded.has(filter.id) || !isCompleteFilter(filter, fields) }));
  const rules = [...persisted, ...drafts];
  useEffect(() => { if (!pickerOpen) return; }, [pickerOpen]);
  const setRule = (rule: DraftFilter, next: DraftFilter) => {
    if (config.filters.some((filter) => filter.id === rule.id)) {
      if (isCompleteFilter(next, fields)) onChange({ ...config, filters: replace(config.filters, config.filters.findIndex((filter) => filter.id === rule.id), stripExpanded(next)) });
      else setDrafts((current) => [...current.filter((draft) => draft.id !== rule.id), next]);
      return;
    }
    if (isCompleteFilter(next, fields)) {
      onChange({ ...config, filters: [...config.filters, stripExpanded(next)] });
      setDrafts((current) => current.filter((draft) => draft.id !== rule.id));
      setExpanded((current) => new Set([...current, rule.id]));
    } else setDrafts((current) => replace(current, current.findIndex((draft) => draft.id === rule.id), next));
  };
  const remove = (rule: DraftFilter) => {
    if (config.filters.some((filter) => filter.id === rule.id)) onChange({ ...config, filters: config.filters.filter((filter) => filter.id !== rule.id) });
    setDrafts((current) => current.filter((draft) => draft.id !== rule.id));
  };
  const chooseField = (field: FieldSummary) => {
    const rule: DraftFilter = { id: newId(), fieldId: field.id, operator: filterOperatorsFor(field)[0] ?? "contains", value: "", expanded: true };
    setPickerOpen(false);
    setDrafts((current) => [...current, rule]);
    requestAnimationFrame(() => operatorRefs.current[rule.id]?.focus());
  };
  const toggle = (rule: DraftFilter) => {
    if (config.filters.some((filter) => filter.id === rule.id)) setExpanded((current) => { const next = new Set(current); if (next.has(rule.id)) next.delete(rule.id); else next.add(rule.id); return next; });
    else setDrafts((current) => replace(current, current.findIndex((draft) => draft.id === rule.id), { ...rule, expanded: !rule.expanded }));
  };
  return <Panel title="筛选" onClose={onClose} wide>
    <p className="morfra-filter-and-note">满足以下全部条件</p>
    {rules.map((rule) => {
      const field = fields.find((item) => item.id === rule.fieldId);
      if (!field) return null;
      return <FilterCard key={rule.id} rule={rule} field={field} operatorRef={(node) => { operatorRefs.current[rule.id] = node; }} onChange={(next) => setRule(rule, next)} onRemove={() => remove(rule)} onToggle={() => toggle(rule)} />;
    })}
    {pickerOpen ? <FieldPicker fields={fields} visibleIds={visibleIds} onChoose={chooseField} onBack={() => setPickerOpen(false)} /> : <button type="button" className="morfra-filter-add" onClick={() => setPickerOpen(true)}>＋ 添加筛选条件</button>}
  </Panel>;
}

function FieldPicker({ fields, visibleIds, onChoose, onBack }: { fields: FieldSummary[]; visibleIds: Set<string>; onChoose: (field: FieldSummary) => void; onBack: () => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, []);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])]; const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") { event.preventDefault(); onBack(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[next]?.focus();
  };
  return <div ref={listRef} className="morfra-filter-field-picker" role="listbox" aria-label="选择筛选字段" onKeyDown={onKeyDown}>
    {fields.map((field) => <button key={field.id} type="button" role="option" aria-selected="false" onClick={() => onChoose(field)}><span aria-hidden="true">{fieldTypeIcon(field)}</span><span>{field.name}</span>{!visibleIds.has(field.id) && <em>已隐藏</em>}</button>)}
  </div>;
}

function FilterCard({ rule, field, operatorRef, onChange, onRemove, onToggle }: { rule: DraftFilter; field: FieldSummary; operatorRef: (node: HTMLSelectElement | null) => void; onChange: (rule: DraftFilter) => void; onRemove: () => void; onToggle: () => void }) {
  const complete = isCompleteFilter(rule, [field]);
  const summary = `${field.name} ${operatorLabel(rule.operator, field)}${needsValue(rule.operator) && complete ? ` ${displayValue(rule.value, field)}` : ""}`;
  return <section className="morfra-filter-card" aria-label={`${field.name} 筛选条件`}>
    <header><button type="button" className="morfra-filter-card-toggle" aria-expanded={rule.expanded} aria-label={`${rule.expanded ? "收起" : "展开"} ${field.name} 筛选条件`} onClick={onToggle}><span aria-hidden="true">{rule.expanded ? "⌄" : "›"}</span><span aria-hidden="true">{fieldTypeIcon(field)}</span><strong>{field.name}</strong></button><button type="button" aria-label={`删除 ${field.name} 筛选条件`} onClick={onRemove}>×</button></header>
    {rule.expanded ? <div className="morfra-filter-card-controls"><select ref={operatorRef} aria-label={`${field.name} 筛选运算符`} value={rule.operator} onChange={(event) => onChange({ ...rule, operator: event.target.value as FilterOperator, value: needsValue(event.target.value as FilterOperator) ? rule.value : undefined })}>{filterOperatorsFor(field).map((operator) => <option key={operator} value={operator}>{operatorLabel(operator, field)}</option>)}</select><ConditionValue field={field} operator={rule.operator} value={rule.value} label={`${field.name} 筛选值`} onChange={(value) => onChange({ ...rule, value })} /></div> : <p className="morfra-filter-card-summary">{summary}</p>}
  </section>;
}

function needsValue(operator: FilterOperator) { return !["isEmpty", "isNotEmpty", "isChecked", "isUnchecked"].includes(operator); }
function stripExpanded({ expanded: _expanded, ...rule }: DraftFilter): ViewFilter { return rule; }
function displayValue(value: JsonValue | undefined, field: FieldSummary) { if (field.fieldType === "select" || field.fieldType === "multi_select") return field.options.find((option) => option.id === value)?.name ?? String(value ?? ""); return String(value ?? ""); }

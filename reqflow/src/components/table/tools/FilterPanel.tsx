import { ConditionRow, newId, Panel, type PanelProps, replace } from "./viewToolShared";

export function FilterPanel({ fields, config, onChange, onClose }: PanelProps) {
  const add = () => onChange({ ...config, filters: [...config.filters, { id: newId(), fieldId: fields[0]?.id ?? "", operator: "contains", value: "" }] });
  return <Panel title="筛选" onClose={onClose}>
    <label>满足<select value={config.filterMode} onChange={(event) => onChange({ ...config, filterMode: event.target.value === "any" ? "any" : "all" })}><option value="all">全部条件</option><option value="any">任一条件</option></select></label>
    {config.filters.map((filter, index) => <ConditionRow key={filter.id} fields={fields} condition={filter} onChange={(next) => onChange({ ...config, filters: replace(config.filters, index, next) })} onRemove={() => onChange({ ...config, filters: config.filters.filter((_, item) => item !== index) })} />)}
    <button type="button" onClick={add}>添加条件</button>
    {config.filters.length > 0 && <button type="button" onClick={() => onChange({ ...config, filters: [] })}>清除筛选</button>}
  </Panel>;
}

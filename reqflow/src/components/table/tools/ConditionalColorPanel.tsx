import { useState } from "react";
import { isCompleteCondition, type ConditionalColorRule, type FilterOperator } from "../../../lib/table/viewPipeline";
import { ConditionValue, fieldOptions, move, newId, operatorOptions, operatorsFor, Panel, type PanelProps, replace } from "./viewToolShared";

export function ConditionalColorPanel({ fields, config, onChange, onClose }: PanelProps) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<ConditionalColorRule[]>([]);
  const rules = [...config.conditionalColors, ...drafts];
  const add = () => setDrafts((current) => [...current, { id: newId(), fieldId: fields[0]?.id ?? "", operator: "contains", value: "", color: "blue", enabled: true }]);
  const update = (index: number, next: ConditionalColorRule) => {
    const persisted = index < config.conditionalColors.length;
    const complete = isCompleteCondition(next, fields);
    if (persisted && complete) onChange({ ...config, conditionalColors: replace(config.conditionalColors, index, next) });
    if (!persisted && complete) { onChange({ ...config, conditionalColors: [...config.conditionalColors, next] }); setDrafts((current) => current.filter((item) => item.id !== next.id)); }
    if (persisted && !complete) { onChange({ ...config, conditionalColors: config.conditionalColors.filter((_, item) => item !== index) }); setDrafts((current) => [...current, next]); }
    if (!persisted && !complete) setDrafts((current) => replace(current, index - config.conditionalColors.length, next));
  };
  const remove = (index: number) => index < config.conditionalColors.length ? onChange({ ...config, conditionalColors: config.conditionalColors.filter((_, item) => item !== index) }) : setDrafts((current) => current.filter((_, item) => item !== index - config.conditionalColors.length));
  return <Panel title="条件填色" onClose={onClose} wide>
    {rules.map((rule, index) => <div key={rule.id} draggable={index < config.conditionalColors.length} onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged !== null && dragged < config.conditionalColors.length && index < config.conditionalColors.length) onChange({ ...config, conditionalColors: move(config.conditionalColors, dragged, index) }); setDragged(null); }}>
      <ColorRuleRow fields={fields} rule={rule} onChange={(next) => update(index, next)} onCopy={() => { const copy = { ...rule, id: newId() }; if (isCompleteCondition(copy, fields)) onChange({ ...config, conditionalColors: [...config.conditionalColors.slice(0, Math.min(index + 1, config.conditionalColors.length)), copy, ...config.conditionalColors.slice(Math.min(index + 1, config.conditionalColors.length))] }); else setDrafts((current) => [...current, copy]); }} onRemove={() => remove(index)} />
    </div>)}
    <button type="button" onClick={add}>添加规则</button>
    {rules.length > 0 && <button type="button" onClick={() => { onChange({ ...config, conditionalColors: [] }); setDrafts([]); }}>清除规则</button>}
  </Panel>;
}

function ColorRuleRow({ fields, rule, onChange, onCopy, onRemove }: { fields: PanelProps["fields"]; rule: ConditionalColorRule; onChange: (value: ConditionalColorRule) => void; onCopy: () => void; onRemove: () => void }) {
  const field = fields.find((item) => item.id === rule.fieldId) ?? fields[0];
  const operators = operatorsFor(field);
  return <div className="morfra-view-tool-row">
    <span aria-hidden="true">⠿</span>
    <input aria-label="启用条件填色" type="checkbox" checked={rule.enabled} onChange={(event) => onChange({ ...rule, enabled: event.target.checked })} />
    <select aria-label="填色字段" value={rule.fieldId} onChange={(event) => { const nextField = fields.find((item) => item.id === event.target.value); onChange({ ...rule, fieldId: event.target.value, operator: operatorsFor(nextField)[0] ?? "equals", value: "" }); }}>{fieldOptions(fields)}</select>
    <select aria-label="填色条件" value={rule.operator} onChange={(event) => onChange({ ...rule, operator: event.target.value as FilterOperator })}>{operatorOptions(operators, field)}</select>
    <ConditionValue field={field} operator={rule.operator} value={rule.value} label="填色值" onChange={(value) => onChange({ ...rule, value })} />
    <select aria-label="填色颜色" value={rule.color} onChange={(event) => onChange({ ...rule, color: event.target.value as ConditionalColorRule["color"] })}>{["gray", "blue", "green", "yellow", "red", "purple"].map((color) => <option key={color} value={color}>{color}</option>)}</select>
    <button type="button" aria-label="复制填色规则" onClick={onCopy}>复制</button>
    <button type="button" aria-label="删除填色规则" onClick={onRemove}>×</button>
  </div>;
}

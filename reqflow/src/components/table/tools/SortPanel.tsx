import { useState } from "react";
import type { FieldSummary } from "../../../types/domain";
import { move, newId, Panel, type PanelProps, replace } from "./viewToolShared";

export function SortPanel({ fields, config, onChange, onClose }: PanelProps) {
  const [dragged, setDragged] = useState<number | null>(null);
  const sortable = fields.filter((field) => !["image", "file", "link"].includes(field.fieldType));
  const add = () => onChange({ ...config, sorts: [...config.sorts, { id: newId(), fieldId: sortable.find((field) => !config.sorts.some((sort) => sort.fieldId === field.id))?.id ?? "", direction: "asc" }] });
  return <Panel title="排序" onClose={onClose}>
    {config.sorts.map((sort, index) => <div draggable className="morfra-view-tool-row" key={sort.id} onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged !== null) onChange({ ...config, sorts: move(config.sorts, dragged, index) }); setDragged(null); }}>
      <span aria-hidden="true">⠿</span>
      <select aria-label="排序字段" value={sort.fieldId} onChange={(event) => onChange({ ...config, sorts: replace(config.sorts, index, { ...sort, fieldId: event.target.value }) })}>{sortable.map((field) => <option key={field.id} value={field.id} disabled={field.id !== sort.fieldId && config.sorts.some((item) => item.fieldId === field.id)}>{field.name}</option>)}</select>
      <select aria-label="排序方向" value={sort.direction} onChange={(event) => onChange({ ...config, sorts: replace(config.sorts, index, { ...sort, direction: event.target.value === "desc" ? "desc" : "asc" }) })}>{directionOptions(sortable.find((field) => field.id === sort.fieldId))}</select>
      <button type="button" aria-label="删除排序" onClick={() => onChange({ ...config, sorts: config.sorts.filter((_, item) => item !== index) })}>×</button>
    </div>)}
    <button type="button" onClick={add}>添加排序</button>
    {config.sorts.length > 0 && <button type="button" onClick={() => onChange({ ...config, sorts: [] })}>清除排序</button>}
  </Panel>;
}

function directionOptions(field?: FieldSummary) { const labels = field?.fieldType === "checkbox" ? ["未勾选优先", "已勾选优先"] : ["select", "multi_select"].includes(field?.fieldType ?? "") ? ["选项顺序", "选项倒序"] : ["number", "progress", "auto_number"].includes(field?.fieldType ?? "") ? ["从小到大", "从大到小"] : ["date", "created_time", "updated_time"].includes(field?.fieldType ?? "") ? ["从早到晚", "从晚到早"] : ["A → Z", "Z → A"]; return <><option value="asc">{labels[0]}</option><option value="desc">{labels[1]}</option></>; }

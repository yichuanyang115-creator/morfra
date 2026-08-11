import { useState } from "react";
import { fieldOptions, move, newId, Panel, type PanelProps, replace } from "./viewToolShared";

export function SortPanel({ fields, config, onChange, onClose }: PanelProps) {
  const [dragged, setDragged] = useState<number | null>(null);
  const add = () => onChange({ ...config, sorts: [...config.sorts, { id: newId(), fieldId: fields[0]?.id ?? "", direction: "asc" }] });
  return <Panel title="排序" onClose={onClose}>
    {config.sorts.map((sort, index) => <div draggable className="morfra-view-tool-row" key={sort.id} onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged !== null) onChange({ ...config, sorts: move(config.sorts, dragged, index) }); setDragged(null); }}>
      <span aria-hidden="true">⠿</span>
      <select aria-label="排序字段" value={sort.fieldId} onChange={(event) => onChange({ ...config, sorts: replace(config.sorts, index, { ...sort, fieldId: event.target.value }) })}>{fieldOptions(fields)}</select>
      <select aria-label="排序方向" value={sort.direction} onChange={(event) => onChange({ ...config, sorts: replace(config.sorts, index, { ...sort, direction: event.target.value === "desc" ? "desc" : "asc" }) })}><option value="asc">正序</option><option value="desc">倒序</option></select>
      <button type="button" aria-label="删除排序" onClick={() => onChange({ ...config, sorts: config.sorts.filter((_, item) => item !== index) })}>×</button>
    </div>)}
    <button type="button" onClick={add}>添加排序</button>
    {config.sorts.length > 0 && <button type="button" onClick={() => onChange({ ...config, sorts: [] })}>清除排序</button>}
  </Panel>;
}

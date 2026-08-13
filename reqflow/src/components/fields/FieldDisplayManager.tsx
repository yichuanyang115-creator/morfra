import { useMemo, useState, type DragEvent } from "react";
import type { FieldSummary } from "../../types/domain";
import { Panel } from "../table/tools/viewToolShared";

interface Props {
  fields: FieldSummary[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
  title?: string;
  description?: string;
  onReset?: () => void;
}

type Dragged = string | null;

export function FieldDisplayManager({ fields, selectedIds, onChange, onClose, title = "字段显示", description = "只影响当前视图，不改表级字段结构。", onReset }: Props) {
  const [query, setQuery] = useState("");
  const [dragged, setDragged] = useState<Dragged>(null);
  const orderedFields = useMemo(() => { const positions = new Map(selectedIds.map((id, index) => [id, index])); return [...fields].sort((left, right) => (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER)); }, [fields, selectedIds]);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  function toggle(field: FieldSummary) {
    if (field.isTitle) return;
    const nextSelected = selectedIds.includes(field.id) ? selectedIds.filter((id) => id !== field.id) : [...selectedIds, field.id];
    onChange(orderSelectedIds(nextSelected, orderedFields));
  }

  function dragStart(event: DragEvent, item: string) {
    event.dataTransfer.effectAllowed = "move";
    setDragged(item);
  }

  function dropField(target: FieldSummary) {
    if (!dragged || dragged === target.id || target.isTitle || !selectedIds.includes(dragged) || !selectedIds.includes(target.id)) return;
    const next = orderedFields.filter((field) => selectedIds.includes(field.id)).map((field) => field.id);
    const from = next.indexOf(dragged);
    const to = next.indexOf(target.id);
    next.splice(from, 1);
    next.splice(to, 0, dragged);
    const titleId = fields.find((field) => field.isTitle)?.id;
    onChange(titleId ? [titleId, ...next.filter((id) => id !== titleId)] : next);
    setDragged(null);
  }

  return <Panel title={title} onClose={onClose}><p>{description}</p>{onReset && <div className="morfra-view-tool-row"><button type="button" onClick={() => onChange(fields.map((field) => field.id))}>全部显示</button><button type="button" onClick={() => onChange(fields.filter((field) => field.isTitle).map((field) => field.id))}>隐藏其他字段</button><button type="button" onClick={onReset}>重置布局</button></div>}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索字段" aria-label="搜索字段" />{orderedFields.filter((field) => !normalizedQuery || field.name.toLocaleLowerCase().includes(normalizedQuery)).map((field) => <label key={field.id} draggable={!field.isTitle && selectedIds.includes(field.id)} onDragStart={(event) => dragStart(event, field.id)} onDragOver={(event) => { if (!field.isTitle) event.preventDefault(); }} onDrop={() => dropField(field)} className="morfra-view-tool-row"><span aria-hidden="true">⠿</span><input type="checkbox" checked={selectedIds.includes(field.id)} onChange={() => toggle(field)} disabled={field.isTitle} /><span>{field.name}{field.isTitle ? " · 主标题" : ""}</span></label>)}</Panel>;
}
function orderSelectedIds(selectedIds: string[], fields: FieldSummary[]): string[] {
  const selected = new Set(selectedIds);
  return fields.map((field) => field.id).filter((id) => selected.has(id));
}

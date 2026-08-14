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
  embedded?: boolean;
}

type Dragged = string | null;

export function FieldDisplayManager({ fields, selectedIds, onChange, onClose, title = "当前视图字段布局", description = "只影响当前视图，不改表级字段结构。", onReset, embedded = false }: Props) {
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

  function moveField(field: FieldSummary, delta: -1 | 1) {
    if (field.isTitle || !selectedIds.includes(field.id)) return;
    const selected = orderedFields.filter((item) => selectedIds.includes(item.id));
    const index = selected.findIndex((item) => item.id === field.id);
    const target = index + delta;
    if (target <= 0 || target >= selected.length) return;
    const next = selected.map((item) => item.id);
    [next[index], next[target]] = [next[target], next[index]];
    const titleId = fields.find((item) => item.isTitle)?.id;
    onChange(titleId ? [titleId, ...next.filter((id) => id !== titleId)] : next);
  }

  const content = <><p>{description}</p>{onReset && <div className="morfra-view-tool-row"><button type="button" onClick={() => onChange(fields.map((field) => field.id))}>全部显示</button><button type="button" onClick={() => onChange(fields.filter((field) => field.isTitle).map((field) => field.id))}>隐藏其他字段</button><button type="button" onClick={onReset}>重置布局</button></div>}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索字段" aria-label="搜索字段" />{orderedFields.filter((field) => !normalizedQuery || field.name.toLocaleLowerCase().includes(normalizedQuery)).map((field) => { const visible = selectedIds.includes(field.id); const selected = orderedFields.filter((item) => selectedIds.includes(item.id)); const index = selected.findIndex((item) => item.id === field.id); return <div key={field.id} draggable={!field.isTitle && visible} onDragStart={(event) => dragStart(event, field.id)} onDragOver={(event) => { if (!field.isTitle) event.preventDefault(); }} onDrop={() => dropField(field)} className="morfra-view-tool-row"><span aria-hidden="true">⠿</span><label><input type="checkbox" checked={visible} onChange={() => toggle(field)} disabled={field.isTitle} />{field.name}{field.isTitle ? " · 主标题" : ""}</label>{!field.isTitle && !visible && <span>已隐藏</span>}{!field.isTitle && visible && <><button type="button" aria-label={`上移 ${field.name} 字段`} disabled={index <= 1} onClick={() => moveField(field, -1)}>↑</button><button type="button" aria-label={`下移 ${field.name} 字段`} disabled={index === selected.length - 1} onClick={() => moveField(field, 1)}>↓</button></>}</div>; })}</>;
  return embedded ? <section className="morfra-field-layout-manager" aria-labelledby="field-layout-title"><h3 id="field-layout-title">{title}</h3>{content}</section> : <Panel title={title} onClose={onClose}>{content}</Panel>;
}
function orderSelectedIds(selectedIds: string[], fields: FieldSummary[]): string[] {
  const selected = new Set(selectedIds);
  return fields.map((field) => field.id).filter((id) => selected.has(id));
}

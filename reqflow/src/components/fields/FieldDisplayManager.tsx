import { useMemo, useState, type DragEvent } from "react";
import type { FieldGroupSummary, FieldSummary } from "../../types/domain";

interface Props {
  fields: FieldSummary[];
  selectedIds: string[];
  groupOrder?: string[];
  groups?: FieldGroupSummary[];
  onChange: (ids: string[], groupOrder?: string[]) => void;
  onClose: () => void;
  title?: string;
  description?: string;
  onReset?: () => void;
}

type Dragged = { kind: "group" | "field"; id: string } | null;
interface FieldBlock { id: string; fields: FieldSummary[]; }

export function FieldDisplayManager({ fields, selectedIds, groupOrder = [], groups = [], onChange, onClose, title = "字段显示", description = "只影响当前视图，不改表级字段结构。", onReset }: Props) {
  const [query, setQuery] = useState("");
  const [dragged, setDragged] = useState<Dragged>(null);
  const byId = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
  const blocks = useMemo(() => buildBlocks(fields, selectedIds, groups, groupOrder), [fields, groupOrder, groups, selectedIds]);
  const groupNames = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  function toggle(field: FieldSummary) {
    if (field.isTitle) return;
    const nextSelected = selectedIds.includes(field.id) ? selectedIds.filter((id) => id !== field.id) : [...selectedIds, field.id];
    onChange(orderSelectedIds(nextSelected, blocks), groupIdsFromBlocks(blocks));
  }

  function dragStart(event: DragEvent, item: NonNullable<Dragged>) {
    event.dataTransfer.effectAllowed = "move";
    setDragged(item);
  }

  function dropGroup(targetId: string) {
    if (!dragged || dragged.kind !== "group" || dragged.id === targetId) return;
    const from = blocks.findIndex((block) => block.id === dragged.id);
    const to = blocks.findIndex((block) => block.id === targetId);
    if (from < 0 || to < 0) return;
    const nextBlocks = [...blocks];
    const [block] = nextBlocks.splice(from, 1);
    nextBlocks.splice(to, 0, block);
    onChange(orderSelectedIds(selectedIds, nextBlocks), groupIdsFromBlocks(nextBlocks));
    setDragged(null);
  }

  function dropField(target: FieldSummary) {
    if (!dragged || dragged.kind !== "field" || dragged.id === target.id) return;
    const source = byId.get(dragged.id);
    if (!source || source.groupId !== target.groupId || source.isTitle || !selectedIds.includes(source.id) || !selectedIds.includes(target.id)) return;
    const next = [...selectedIds];
    const from = next.indexOf(source.id);
    const to = next.indexOf(target.id);
    next.splice(from, 1);
    next.splice(to, 0, source.id);
    onChange(next, groupIdsFromBlocks(blocks));
    setDragged(null);
  }

  return <div className="fixed inset-0 z-60 flex items-start justify-end bg-(--overlay-scrim)" role="dialog" aria-modal="true" aria-labelledby="field-display-title">
    <section className="m-4 w-[min(92vw,380px)] rounded-(--r-lg) bg-(--module-scope-background-surface) p-5 shadow-(--shadow-dialog)">
      <header className="flex items-start justify-between"><div><h2 id="field-display-title" className="m-0 text-[15px] font-semibold text-(--module-scope-text-primary)">{title}</h2><p className="m-0 mt-1 text-[11px] text-(--module-scope-text-tertiary)">{description}</p></div><button type="button" onClick={onClose}>关闭</button></header>
      {onReset && <div className="mt-3 flex gap-2 text-[11px]"><button type="button" onClick={() => onChange(fields.map((field) => field.id), groupIdsFromBlocks(buildBlocks(fields, fields.map((field) => field.id), groups, [])))}>全部显示</button><button type="button" onClick={() => onChange(fields.filter((field) => field.isTitle).map((field) => field.id), groupIdsFromBlocks(blocks))}>仅主标题</button><button type="button" onClick={onReset}>重置布局</button></div>}
      <input className="mt-3 w-full rounded border p-1.5 text-[12px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索字段" aria-label="搜索字段" />
      <div className="mt-4 space-y-3">{blocks.map((block) => <section key={block.id} data-testid={`field-group-${block.id}`} draggable={block.id !== "title"} onDragStart={(event) => dragStart(event, { kind: "group", id: block.id })} onDragOver={(event) => { if (block.id !== "title") event.preventDefault(); }} onDrop={() => { if (block.id !== "title") dropGroup(block.id); }} className="rounded border border-(--module-scope-border-subtle) p-2">
        <p className="m-0 mb-1 text-[11px] text-(--module-scope-text-tertiary)">⠿ {block.id === "title" ? "主标题" : groupNames.get(block.id) ?? "未分组"}</p>
        {block.fields.filter((field) => !normalizedQuery || field.name.toLocaleLowerCase().includes(normalizedQuery)).map((field) => <label key={field.id} draggable={!field.isTitle && selectedIds.includes(field.id)} onDragStart={(event) => dragStart(event, { kind: "field", id: field.id })} onDragOver={(event) => { if (!field.isTitle) event.preventDefault(); }} onDrop={() => { if (!field.isTitle) dropField(field); }} className="flex items-center gap-2 py-1 text-[12px]"><span aria-hidden="true">⠿</span><input type="checkbox" checked={selectedIds.includes(field.id)} onChange={() => toggle(field)} disabled={field.isTitle} /><span>{field.name}{field.isTitle ? " · 主标题" : ""}</span></label>)}
      </section>)}</div>
      <div className="mt-5 flex justify-end"><button type="button" onClick={onClose}>完成</button></div>
    </section>
  </div>;
}

function buildBlocks(fields: FieldSummary[], selectedIds: string[], groups: FieldGroupSummary[], groupOrder: string[]): FieldBlock[] {
  const selectedPosition = new Map(selectedIds.map((id, index) => [id, index]));
  const titleFields = fields.filter((field) => field.isTitle);
  const defaultIds = [...[...groups].sort((left, right) => left.position - right.position).map((group) => group.id), ...fields.filter((field) => !field.isTitle).map((field) => field.groupId ?? "ungrouped")];
  const validIds = new Set(defaultIds);
  const orderedGroupIds = [...new Set([...groupOrder.filter((id) => validIds.has(id)), ...defaultIds])];
  const blocks = orderedGroupIds.map((id) => ({ id, fields: fields.filter((field) => !field.isTitle && (field.groupId ?? "ungrouped") === id).sort((left, right) => (selectedPosition.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (selectedPosition.get(right.id) ?? Number.MAX_SAFE_INTEGER)) }));
  return titleFields.length ? [{ id: "title", fields: titleFields }, ...blocks] : blocks;
}

function groupIdsFromBlocks(blocks: FieldBlock[]): string[] { return blocks.filter((block) => block.id !== "title").map((block) => block.id); }

function orderSelectedIds(selectedIds: string[], blocks: FieldBlock[]): string[] {
  const selected = new Set(selectedIds);
  return blocks.flatMap((block) => block.fields.map((field) => field.id).filter((id) => selected.has(id)));
}

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { FieldSummary, JsonValue, RecordData, TableDataSnapshot } from "../../types/domain";
import type { ViewPipelineConfig } from "../../lib/table/viewPipeline";
import { formatCellValue, isReadOnlyField, valueForCell } from "../table/cellValue";
import { buildBoardColumns, moveCardValue, parseBoardConfig, removeCardFromColumnValue, type BoardViewConfig } from "../../lib/board/boardProjection";

const COLUMN_WIDTH = 272;
const COLUMN_GAP = 10;
const COLLAPSED_COLUMN_WIDTH = 44;

interface KanbanViewProps {
  data: TableDataSnapshot;
  records: RecordData[];
  config: BoardViewConfig;
  pipeline: ViewPipelineConfig;
  onConfigChange: (config: BoardViewConfig) => void;
  onCreate: (values: Record<string, JsonValue>) => Promise<unknown>;
  onUpdate: (recordId: string, fieldId: string, value: JsonValue) => Promise<unknown>;
  onMove: (recordId: string, fieldId: string, value: JsonValue, boardConfig: BoardViewConfig) => Promise<unknown>;
  onDelete: (recordId: string) => Promise<unknown>;
  onUndo?: () => Promise<unknown>;
  onOpenDetail: (recordId: string) => void;
}

export function KanbanView({ data, records, config, pipeline, onConfigChange, onCreate, onUpdate, onMove, onDelete, onUndo, onOpenDetail }: KanbanViewProps) {
  const [dragged, setDragged] = useState<{ recordId: string; sourceKey: string } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [undoGroupChange, setUndoGroupChange] = useState<BoardViewConfig | null>(null);
  const [undoAction, setUndoAction] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ left: 0, width: 0 });
  const board = useMemo(() => parseBoardConfig(config as unknown as JsonValue, data.fields), [config, data.fields]);
  const groupField = data.fields.find((field) => field.id === board.groupFieldId) ?? null;
  const columns = useMemo(() => buildBoardColumns(records, data.fields, board, pipeline), [board, data.fields, pipeline, records]);
  const recordsById = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
  const titleField = data.fields.find((field) => field.isTitle);
  const cardFields = data.fields.filter((field) => board.fieldIds.includes(field.id) && !field.isTitle);
  const columnTracks = useMemo(() => {
    let left = 0;
    return columns.map((column) => {
      const collapsed = board.collapsedKeys.includes(column.key);
      const width = collapsed ? COLLAPSED_COLUMN_WIDTH : COLUMN_WIDTH;
      const track = { column, collapsed, left, width };
      left += width + COLUMN_GAP;
      return track;
    });
  }, [board.collapsedKeys, columns]);
  const lastTrack = columnTracks[columnTracks.length - 1];
  const contentWidth = lastTrack ? lastTrack.left + lastTrack.width + COLUMN_GAP : 0;
  const visibleWidth = Math.max(viewport.width, COLUMN_WIDTH * 4);
  const visibleColumns = columnTracks.filter((track) => track.left + track.width >= viewport.left - COLUMN_WIDTH * 2 && track.left <= viewport.left + visibleWidth + COLUMN_WIDTH * 2);
  const change = (next: Partial<BoardViewConfig>) => onConfigChange({ ...board, ...next });
  useEffect(() => { const node = viewportRef.current; if (!node) return; const resize = () => setViewport((value) => ({ ...value, width: node.clientWidth })); resize(); if (typeof ResizeObserver === "undefined") return; const observer = new ResizeObserver(resize); observer.observe(node); return () => observer.disconnect(); }, []);

  function changeGroup(nextFieldId: string | null) {
    if (nextFieldId === board.groupFieldId) return;
    if ((board.columnOrder.length > 0 || Object.values(board.cardPositions).some((ids) => ids.length)) && !window.confirm("更换分组字段会清除当前看板的列顺序和卡片位置，是否继续？")) return;
    setUndoGroupChange(board);
    change({ groupFieldId: nextFieldId, columnOrder: [], cardPositions: {}, collapsedKeys: [] });
  }

  function reorderColumns(targetKey: string) {
    const source = draggedColumn;
    setDraggedColumn(null);
    if (!source || source === targetKey) return;
    const ids = columns.map((column) => column.key).filter((key) => key !== "__empty__");
    const from = ids.indexOf(source); const to = ids.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1); ids.splice(to, 0, source);
    change({ columnOrder: ids });
  }

  async function createInColumn(key: string) {
    if (!titleField || !groupField) return;
    const title = window.prompt("记录标题");
    if (!title?.trim()) return;
    const groupValue = key === "__empty__" ? null : groupField.fieldType === "multi_select" ? [key] : groupField.fieldType === "checkbox" ? key === "true" : groupField.fieldType === "number" || groupField.fieldType === "progress" ? Number(key) : key;
    await onCreate({ [titleField.id]: title.trim(), [groupField.id]: groupValue });
  }

  async function drop(event: DragEvent<HTMLElement>, targetKey: string, beforeId?: string) {
    event.preventDefault();
    const source = dragged;
    setDragged(null);
    if (!source || !groupField) return;
    const record = recordsById.get(source.recordId);
    if (!record) return;
    if (source.sourceKey === targetKey && pipeline.sorts.length > 0) return;
    const targetValue = moveCardValue(record, groupField, source.sourceKey, targetKey);
    if (targetValue === null) return;
    if (pipeline.sorts.length > 0) {
      await onMove(record.id, groupField.id, targetValue, board);
      setUndoAction("已移动记录");
      return;
    }
    const targetIds = (columns.find((column) => column.key === targetKey)?.recordIds ?? []).filter((id) => id !== record.id);
    const insertion = beforeId ? Math.max(0, targetIds.indexOf(beforeId)) : targetIds.length;
    targetIds.splice(insertion < 0 ? targetIds.length : insertion, 0, record.id);
    const positions = { ...board.cardPositions, [targetKey]: targetIds };
    if (source.sourceKey !== targetKey) positions[source.sourceKey] = (positions[source.sourceKey] ?? []).filter((id) => id !== record.id);
    await onMove(record.id, groupField.id, targetValue, { ...board, cardPositions: positions });
    setUndoAction("已移动记录");
  }

  async function removeFromColumn(record: RecordData, columnKey: string) {
    if (!groupField || isReadOnlyField(groupField)) return;
    const next = groupField.fieldType === "multi_select" ? removeCardFromColumnValue(record, groupField, columnKey) : null;
    await onUpdate(record.id, groupField.id, next);
    setUndoAction("已移出分组");
  }

  async function deleteCard(record: RecordData) {
    const title = titleField ? formatCellValue(titleField, valueForCell(titleField, record)) : "该记录";
    if (!window.confirm(`删除“${title}”？`)) return;
    await onDelete(record.id);
    setUndoAction("已删除记录");
  }

  async function undoLastAction() {
    if (!onUndo) return;
    await onUndo();
    setUndoAction(null);
  }

  return <section className="morfra-kanban" aria-label="派生看板">
    <header className="morfra-kanban-controls">
      <label>分组字段<select aria-label="看板分组字段" value={board.groupFieldId ?? ""} onChange={(event) => changeGroup(event.target.value || null)}>{data.fields.filter((field) => !field.isTitle).map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
      <details className="morfra-kanban-fields"><summary>卡片字段 {cardFields.length}</summary>{data.fields.filter((field) => !field.isTitle).map((field) => <label key={field.id}><input type="checkbox" checked={board.fieldIds.includes(field.id)} onChange={(event) => change({ fieldIds: event.target.checked ? [...board.fieldIds, field.id] : board.fieldIds.filter((id) => id !== field.id) })} />{field.name}{board.fieldIds.includes(field.id) && <span><button type="button" aria-label={`上移${field.name}`} disabled={board.fieldIds.indexOf(field.id) === 0} onClick={() => { const ids = [...board.fieldIds]; const index = ids.indexOf(field.id); [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; change({ fieldIds: ids }); }}>↑</button><button type="button" aria-label={`下移${field.name}`} disabled={board.fieldIds.indexOf(field.id) === board.fieldIds.length - 1} onClick={() => { const ids = [...board.fieldIds]; const index = ids.indexOf(field.id); [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]; change({ fieldIds: ids }); }}>↓</button></span>}</label>)}</details>
      <span className="morfra-kanban-count">{new Set(columns.flatMap((column) => column.recordIds)).size} 条记录</span>
      <button type="button" onClick={() => change({ collapsedKeys: [] })}>展开全部</button>
      <button type="button" onClick={() => change({ collapsedKeys: columns.map((column) => column.key) })}>折叠全部</button>
      {undoGroupChange && <button type="button" onClick={() => { onConfigChange(undoGroupChange); setUndoGroupChange(null); }}>撤销更换分组</button>}
      {undoAction && onUndo && <span className="morfra-kanban-undo" role="status">{undoAction}<button type="button" onClick={() => void undoLastAction()}>撤销</button></span>}
    </header>
    {!groupField ? <div className="morfra-grid-no-results" role="status">请先添加一个非主标题字段以创建看板分组。</div> : <div className="morfra-kanban-viewport" ref={viewportRef} onScroll={(event) => setViewport((value) => ({ ...value, left: event.currentTarget.scrollLeft }))}><div className="morfra-kanban-columns" style={{ width: `${contentWidth}px`, position: "relative" }}>{visibleColumns.map((track) => <KanbanColumn key={track.column.key} column={track.column} recordsById={recordsById} titleField={titleField} fields={cardFields} left={track.left} width={track.width} collapsed={track.collapsed} onToggle={() => change({ collapsedKeys: board.collapsedKeys.includes(track.column.key) ? board.collapsedKeys.filter((item) => item !== track.column.key) : [...board.collapsedKeys, track.column.key] })} onCreate={() => void createInColumn(track.column.key)} onColumnDragStart={() => { setDragged(null); setDraggedColumn(track.column.key); }} onColumnDrop={() => reorderColumns(track.column.key)} onDragStart={(recordId) => { setDraggedColumn(null); setDragged({ recordId, sourceKey: track.column.key }); }} onDrop={(event, beforeId) => void drop(event, track.column.key, beforeId)} onEdit={(record, field) => { if (isReadOnlyField(field)) return; const initial = formatCellValue(field, valueForCell(field, record)); const next = window.prompt(`编辑${field.name}`, initial); if (next !== null) void onUpdate(record.id, field.id, normalizeValue(field, next)); }} onRemove={(record) => void removeFromColumn(record, track.column.key)} onDelete={(record) => void deleteCard(record)} onOpenDetail={onOpenDetail} />)}</div></div>}
  </section>;
}

function KanbanColumn({ column, recordsById, titleField, fields, left, width, collapsed, onToggle, onCreate, onColumnDragStart, onColumnDrop, onDragStart, onDrop, onEdit, onRemove, onDelete, onOpenDetail }: { column: ReturnType<typeof buildBoardColumns>[number]; recordsById: Map<string, RecordData>; titleField?: FieldSummary; fields: FieldSummary[]; left: number; width: number; collapsed: boolean; onToggle: () => void; onCreate: () => void; onColumnDragStart: () => void; onColumnDrop: () => void; onDragStart: (recordId: string) => void; onDrop: (event: DragEvent<HTMLElement>, beforeId?: string) => void; onEdit: (record: RecordData, field: FieldSummary) => void; onRemove: (record: RecordData) => void; onDelete: (record: RecordData) => void; onOpenDetail: (recordId: string) => void; }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const visible = Math.max(12, Math.ceil((scrollRef.current?.clientHeight ?? 540) / 116) + 6);
  const start = Math.max(0, Math.floor(scrollTop / 116) - 3);
  const ids = column.recordIds.slice(start, start + visible);
  return <article style={{ left, width }} className={`morfra-kanban-column ${collapsed ? "is-collapsed" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <header draggable={column.key !== "__empty__"} onDragStart={onColumnDragStart} onDrop={(event) => { event.stopPropagation(); onColumnDrop(); }}><button type="button" aria-label={`${collapsed ? "展开" : "折叠"}${column.label}`} onClick={onToggle}>{collapsed ? "›" : "⌄"}</button><strong>{column.label}</strong><span>{column.count}</span></header>
    {!collapsed && <><div className="morfra-kanban-card-list" ref={scrollRef} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}><div style={{ height: `${column.recordIds.length * 116}px`, position: "relative" }}>{ids.map((id, index) => { const record = recordsById.get(id); return record && titleField ? <KanbanCard key={id} record={record} titleField={titleField} fields={fields} top={(start + index) * 116} onDragStart={() => onDragStart(record.id)} onDrop={(event) => onDrop(event, record.id)} onEdit={onEdit} onRemove={() => onRemove(record)} onDelete={() => onDelete(record)} onOpenDetail={() => onOpenDetail(record.id)} /> : null; })}</div></div><button type="button" className="morfra-kanban-add" onClick={onCreate}>＋ 新建记录</button></>}
  </article>;
}

function KanbanCard({ record, titleField, fields, top, onDragStart, onDrop, onEdit, onRemove, onDelete, onOpenDetail }: { record: RecordData; titleField: FieldSummary; fields: FieldSummary[]; top: number; onDragStart: () => void; onDrop: (event: DragEvent<HTMLElement>) => void; onEdit: (record: RecordData, field: FieldSummary) => void; onRemove: () => void; onDelete: () => void; onOpenDetail: () => void; }) {
  return <div className="morfra-kanban-card" draggable style={{ transform: `translateY(${top}px)` }} onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); onDrop(event); }} onClick={onOpenDetail}>
    <button type="button" className="morfra-kanban-card-title" onClick={(event) => { event.stopPropagation(); onOpenDetail(); }}>{formatCellValue(titleField, valueForCell(titleField, record)) || "未命名记录"}</button>
    {fields.map((field) => <button type="button" key={field.id} className="morfra-kanban-card-field" disabled={isReadOnlyField(field)} onClick={(event) => { event.stopPropagation(); onEdit(record, field); }}><span>{field.name}</span><b>{formatCellValue(field, valueForCell(field, record)) || "—"}</b></button>)}
    <div className="morfra-kanban-card-actions"><button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }}>移出分组</button><button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }}>删除</button></div>
  </div>;
}

function normalizeValue(field: FieldSummary, raw: string): JsonValue {
  if (raw.trim() === "") return null;
  if (field.fieldType === "number" || field.fieldType === "progress") return Number(raw);
  if (field.fieldType === "checkbox") return raw === "true" || raw === "是";
  if (field.fieldType === "select") return field.options.find((option) => option.id === raw || option.name === raw)?.id ?? raw;
  if (field.fieldType === "multi_select") return raw.split(",").map((value) => value.trim()).filter(Boolean).map((value) => field.options.find((option) => option.id === value || option.name === value)?.id ?? value);
  return raw;
}

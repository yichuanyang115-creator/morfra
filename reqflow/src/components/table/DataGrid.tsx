import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buildColumnLayouts, clampColumnWidth, stickyOffset } from "../../lib/table/columnLayout";
import type { FieldGroupSummary, FieldSummary, JsonValue, RecordData, TableDataSnapshot } from "../../types/domain";
import { GridBody } from "./GridBody";
import { GridHeader } from "./GridHeader";

export interface GridLayoutConfig { fieldIds: string[]; groupOrder: string[]; columnWidths: Record<string, number>; frozenFieldId: string | null; rowHeight: 32 | 40 | 56; collapsedGroupIds: string[]; }
interface DataGridProps { data: TableDataSnapshot; config: GridLayoutConfig; onConfigChange: (config: GridLayoutConfig) => void; onOpenDetail: (recordId: string) => void; onCreate: () => void; }

export function DataGrid({ data, config, onConfigChange, onOpenDetail, onCreate }: DataGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderedRecordsRef = useRef<RecordData[]>([]);
  const [width, setWidth] = useState(0);
  const visibleFields = useMemo(() => orderedFields(data.fields, data.groups, config.fieldIds, config.collapsedGroupIds), [config.collapsedGroupIds, config.fieldIds, data.fields, data.groups]);
  const groupNames = useMemo(() => Object.fromEntries(data.groups.map((group) => [group.id, group.name])), [data.groups]);
  const layouts = useMemo(() => buildColumnLayouts(visibleFields, config.columnWidths, config.frozenFieldId, width), [config.columnWidths, config.frozenFieldId, visibleFields, width]);
  const table = useReactTable<RecordData>({ data: data.records, columns: layouts.map((layout) => ({ id: layout.field.id, accessorFn: (row) => row.values[layout.field.id] })), getCoreRowModel: getCoreRowModel() });
  useEffect(() => { const node = scrollRef.current; if (!node) return; const observer = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? 0)); observer.observe(node); setWidth(node.clientWidth); return () => observer.disconnect(); }, []);
  const gridStyle = useMemo(() => Object.fromEntries(layouts.filter((layout) => layout.frozen).map((layout) => [`--grid-sticky-${layout.field.id}`, `${stickyOffset(layouts, layout.field.id)}px`])) as CSSProperties, [layouts]);
  const updateRenderedRecords = useCallback((records: RecordData[]) => { renderedRecordsRef.current = records; }, []);
  function update(next: Partial<GridLayoutConfig>) { onConfigChange({ ...config, ...next }); }
  return <section className="morfra-data-grid" aria-label={`表格画布，${table.getRowModel().rows.length} 条记录`} style={gridStyle}>
    <div className="morfra-grid-controls"><span>{data.records.length} 条记录 · {layouts.length} 个可见字段</span><div><label>行高<select aria-label="行高" value={config.rowHeight} onChange={(event) => update({ rowHeight: Number(event.target.value) as GridLayoutConfig["rowHeight"] })}><option value="32">紧凑</option><option value="40">标准</option><option value="56">宽松</option></select></label><button type="button" className="morfra-grid-add-record" onClick={onCreate}>新建记录</button></div></div>
    <div className="morfra-grid-scroll" ref={scrollRef}>
      <GridHeader layouts={layouts} groupNames={groupNames} rowHeight={config.rowHeight} collapsedGroupIds={config.collapsedGroupIds} onToggleGroup={(groupId) => update({ collapsedGroupIds: config.collapsedGroupIds.includes(groupId) ? config.collapsedGroupIds.filter((id) => id !== groupId) : [...config.collapsedGroupIds, groupId] })} onReorderGroup={(sourceId, targetId) => { const groupOrder = moveGroup(config.groupOrder, sourceId, targetId); update({ groupOrder, fieldIds: orderFieldsByGroup(config.fieldIds, data.fields, groupOrder) }); }} onResize={(fieldId, nextWidth) => { const field = data.fields.find((item) => item.id === fieldId); if (field) update({ columnWidths: { ...config.columnWidths, [fieldId]: clampColumnWidth(field, nextWidth) } }); }} onAutoFit={(fieldId) => { const field = data.fields.find((item) => item.id === fieldId); if (!field) return; const longest = Math.max(field.name.length, ...renderedRecordsRef.current.map((record) => String(record.values[fieldId] ?? record.multiSelectValues[fieldId]?.length ?? "").length)); update({ columnWidths: { ...config.columnWidths, [fieldId]: clampColumnWidth(field, longest * 8 + 48) } }); }} onFreezeTo={(fieldId) => update({ frozenFieldId: fieldId })} onClearExtraFreeze={() => update({ frozenFieldId: null })} />
      {data.records.length ? <GridBody parentRef={scrollRef} layouts={layouts} records={data.records} rowHeight={config.rowHeight} onOpenDetail={onOpenDetail} onRenderedRecordsChange={updateRenderedRecords} /> : <div className="morfra-grid-empty-state">还没有记录，请使用上方“新建记录”开始录入。</div>}
    </div>
  </section>;
}

function orderedFields(fields: FieldSummary[], groups: TableDataSnapshot["groups"], fieldIds: string[], collapsedGroups: string[]): FieldSummary[] { const lookup = new Map(fields.map((field) => [field.id, field])); const groupNames = new Map(groups.map((group) => [group.id, group.name])); const visible = fieldIds.map((id) => lookup.get(id)).filter((field): field is FieldSummary => Boolean(field)); const title = visible.find((field) => field.isTitle); const inserted = new Set<string>(); const rest = visible.flatMap((field) => { if (!field.groupId || !collapsedGroups.includes(field.groupId)) return [field]; if (inserted.has(field.groupId)) return []; inserted.add(field.groupId); const count = visible.filter((item) => item.groupId === field.groupId).length; return [{ ...field, id: `collapsed:${field.groupId}`, name: `${groupNames.get(field.groupId) ?? "字段组"} · ${count} 个字段`, fieldType: "text" as const }]; }); return title ? [title, ...rest.filter((field) => !field.isTitle)] : rest; }

export function parseGridLayout(config: JsonValue, fields: FieldSummary[], groups: FieldGroupSummary[] = []): GridLayoutConfig {
  const source = isRecord(config) ? config : {}; const fieldIds = normalizeGridFieldIds(Array.isArray(source.fieldIds) ? source.fieldIds : null, fields); const groupOrder = normalizeGridGroupOrder(Array.isArray(source.groupOrder) ? source.groupOrder : null, fields, groups); const widths = isRecord(source.columnWidths) ? Object.fromEntries(Object.entries(source.columnWidths).filter((entry): entry is [string, number] => typeof entry[1] === "number")) : {}; const frozenFieldId = typeof source.frozenFieldId === "string" ? source.frozenFieldId : null; const rowHeight = source.rowHeight === 32 || source.rowHeight === 56 ? source.rowHeight : 40; const collapsedGroupIds = Array.isArray(source.collapsedGroupIds) ? source.collapsedGroupIds.filter((id): id is string => typeof id === "string") : []; return { fieldIds, groupOrder, columnWidths: widths, frozenFieldId, rowHeight, collapsedGroupIds };
}

export function normalizeGridFieldIds(ids: readonly unknown[] | null | undefined, fields: FieldSummary[]): string[] {
  const allFieldIds = fields.map((field) => field.id);
  if (!ids?.length) return allFieldIds;
  const knownIds = new Set(allFieldIds);
  const uniqueIds = [...new Set(ids.filter((id): id is string => typeof id === "string" && knownIds.has(id)))];
  const titleId = fields.find((field) => field.isTitle)?.id;
  return titleId ? [titleId, ...uniqueIds.filter((id) => id !== titleId)] : uniqueIds;
}

export function normalizeGridGroupOrder(ids: readonly unknown[] | null | undefined, fields: FieldSummary[], groups: FieldGroupSummary[]): string[] {
  const defaults = [...[...groups].sort((left, right) => left.position - right.position).map((group) => group.id), ...fields.filter((field) => !field.isTitle).map((field) => field.groupId ?? "ungrouped")];
  const validIds = new Set(defaults);
  const requested = ids?.filter((id): id is string => typeof id === "string" && validIds.has(id)) ?? [];
  return [...new Set([...requested, ...defaults])];
}

function moveGroup(order: string[], sourceId: string, targetId: string): string[] { const next = [...order]; const from = next.indexOf(sourceId); const to = next.indexOf(targetId); if (from < 0 || to < 0) return order; const [source] = next.splice(from, 1); next.splice(to, 0, source); return next; }
function orderFieldsByGroup(fieldIds: string[], fields: FieldSummary[], groupOrder: string[]): string[] { const byId = new Map(fields.map((field) => [field.id, field])); const titleIds = fieldIds.filter((id) => byId.get(id)?.isTitle); const ordered = groupOrder.flatMap((groupId) => fieldIds.filter((id) => { const field = byId.get(id); return field && !field.isTitle && (field.groupId ?? "ungrouped") === groupId; })); return [...titleIds, ...ordered]; }

function isRecord(value: JsonValue): value is Record<string, JsonValue> { return typeof value === "object" && value !== null && !Array.isArray(value); }

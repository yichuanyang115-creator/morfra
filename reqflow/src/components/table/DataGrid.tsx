import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from "react";
import { buildColumnLayouts, clampColumnWidth, stickyOffset } from "../../lib/table/columnLayout";
import { clipboardText, MORFRA_CLIPBOARD_MIME, parseMorfraClipboard, selectionClipboard, serializeMorfraClipboard } from "../../lib/table/clipboard";
import { directionForKey, isPrintableKey, moveSelection, type GridDirection } from "../../lib/table/keyboardNavigation";
import { buildClearPlan, buildPastePlan, externalPastePlan, type PastePlan } from "../../lib/table/pastePlan";
import { containsCell, moveActive, rangeBounds, singleCell, type GridPoint } from "../../lib/table/selectionModel";
import { useGridInteractionStore } from "../../stores/gridInteractionStore";
import type { FieldGroupSummary, FieldSummary, JsonValue, RecordData, TableDataSnapshot } from "../../types/domain";
import { editableFieldReason, valueForCell } from "./cellValue";
import { GridBody } from "./GridBody";
import { GridHeader } from "./GridHeader";
import { BulkDeleteDialog } from "./BulkDeleteDialog";
import { GridContextMenu, uniformValueAvailability } from "./GridContextMenu";
import { GridPersistentEditor } from "./GridPersistentEditor";
export { GridLoadingSkeleton as DataGridLoadingSkeleton } from "./GridLoadingSkeleton";
const GRID_HEADER_HEIGHT = 64;

export interface GridLayoutConfig { fieldIds: string[]; groupOrder: string[]; columnWidths: Record<string, number>; frozenFieldId: string | null; rowHeight: 32 | 40 | 56; collapsedGroupIds: string[]; }
interface DataGridProps { viewId: string; data: TableDataSnapshot; config: GridLayoutConfig; onConfigChange: (config: GridLayoutConfig) => void; onOpenDetail: (recordId: string) => void; onCreate: () => void; onUpdateCell: (recordId: string, fieldId: string, value: JsonValue) => Promise<unknown>; onApplyTableMutation?: (tableId: string, plan: PastePlan, deleteRecordIds?: string[]) => Promise<unknown>; onUndo?: () => Promise<unknown>; }

export function DataGrid({ viewId, data, config, onConfigChange, onOpenDetail, onCreate, onUpdateCell, onApplyTableMutation, onUndo }: DataGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderedRecordsRef = useRef<RecordData[]>([]);
  const committingRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const gridId = useId();
  const [width, setWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; point: GridPoint; rows: boolean } | null>(null);
  const [deleteCount, setDeleteCount] = useState(0);
  const [operationToast, setOperationToast] = useState<string | null>(null);
  const [operationFailure, setOperationFailure] = useState<{ message: string; retry: () => void } | null>(null);
  const interaction = useGridInteractionStore();
  const currentEditing = interaction.editing?.viewId === viewId && !interaction.editing.direct ? interaction.editing : null;
  const renderedFieldIds = useMemo(() => orderGridFieldIdsByGroup(config.fieldIds, data.fields, config.groupOrder), [config.fieldIds, config.groupOrder, data.fields]);
  const visibleFields = useMemo(() => orderedFields(data.fields, data.groups, renderedFieldIds, config.collapsedGroupIds), [config.collapsedGroupIds, data.fields, data.groups, renderedFieldIds]);
  const groupNames = useMemo(() => Object.fromEntries(data.groups.map((group) => [group.id, group.name])), [data.groups]);
  const layouts = useMemo(() => buildColumnLayouts(visibleFields, config.columnWidths, config.frozenFieldId, width), [config.columnWidths, config.frozenFieldId, visibleFields, width]);
  const table = useReactTable<RecordData>({ data: data.records, columns: layouts.map((layout) => ({ id: layout.field.id, accessorFn: (row) => row.values[layout.field.id] })), getCoreRowModel: getCoreRowModel() });
  useEffect(() => { interaction.initialize(viewId); }, [interaction, viewId]);
  useEffect(() => { const node = scrollRef.current; if (!node) return; const observer = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? 0)); observer.observe(node); setWidth(node.clientWidth); return () => observer.disconnect(); }, []);
  const gridStyle = useMemo(() => Object.fromEntries(layouts.filter((layout) => layout.frozen).map((layout) => [`--grid-sticky-${layout.field.id}`, `${stickyOffset(layouts, layout.field.id)}px`])) as CSSProperties, [layouts]);
  const updateRenderedRecords = useCallback((records: RecordData[]) => { renderedRecordsRef.current = records; }, []);
  function update(next: Partial<GridLayoutConfig>) { onConfigChange({ ...config, ...next }); }

  useEffect(() => {
    const editing = interaction.editing;
    if (!editing || editing.viewId !== viewId || interaction.pendingCommit || layouts[editing.point.column]?.field.fieldType !== "multi_select") return;
    const commitOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest(".morfra-grid-select-editor, .morfra-grid-announcement")) return;
      void commitEditing();
    };
    document.addEventListener("pointerdown", commitOutside, true);
    return () => document.removeEventListener("pointerdown", commitOutside, true);
  }, [interaction.editing, interaction.pendingCommit, layouts, viewId]);

  function scrollToPoint(point: GridPoint) {
    const node = scrollRef.current;
    if (!node) return;
    const left = layouts.slice(0, point.column).reduce((sum, layout) => sum + layout.width, 68);
    const right = left + (layouts[point.column]?.width ?? 0);
    const top = GRID_HEADER_HEIGHT + point.row * config.rowHeight;
    const bottom = top + config.rowHeight;
    if (left < node.scrollLeft) node.scrollLeft = left;
    else if (right > node.scrollLeft + node.clientWidth) node.scrollLeft = Math.max(0, right - node.clientWidth);
    node.scrollTop = nextGridScrollTop(top, bottom, node.scrollTop, node.clientHeight);
  }

  function selectCell(point: GridPoint, extend: boolean) {
    const editing = useGridInteractionStore.getState().editing;
    if (editing?.viewId === viewId && (editing.point.row !== point.row || editing.point.column !== point.column)) void commitEditing();
    const current = useGridInteractionStore.getState().selection;
    interaction.setSelection(current && extend ? moveActive(current, point, true) : singleCell(point));
    scrollToPoint(point);
    scrollRef.current?.focus({ preventScroll: true });
  }

  function startEditing(point: GridPoint, replacement?: string) {
    const state = useGridInteractionStore.getState();
    if (state.pendingCommit) { interaction.setNotice("存在未落盘修改，请先重试或放弃草稿。"); return; }
    const field = layouts[point.column]?.field;
    const record = data.records[point.row];
    if (!field || !record) return;
    const reason = editableFieldReason(field);
    if (reason) { interaction.setNotice(reason); return; }
    interaction.setSelection(singleCell(point));
    const value = valueForCell(field, record);
    setScrollLeft(scrollRef.current?.scrollLeft ?? 0);
    interaction.startEditing({ viewId, point, recordId: record.id, fieldId: field.id, originalValue: value, draft: replacement === undefined ? value : replacement });
    scrollToPoint(point);
  }

  async function commitEditing(direction?: GridDirection) {
    if (committingRef.current) return;
    const state = useGridInteractionStore.getState();
    const editing = state.editing;
    if (!editing) return;
    let recordId = editing.recordId;
    let fieldId = editing.fieldId;
    let value: JsonValue;
    if (state.pendingCommit && state.error && !state.saving) {
      ({ recordId, fieldId, value } = state.pendingCommit);
    } else {
      const field = data.fields.find((item) => item.id === editing.fieldId);
      const record = data.records.find((item) => item.id === editing.recordId);
      if (!field || !record || editing.viewId !== viewId) return;
      const normalized = normalizeValue(field, editing.draft);
      if (normalized instanceof Error) { interaction.setError(normalized.message); return; }
      value = normalized;
    }
    const requestId = `${editing.viewId}:${recordId}:${fieldId}:${++requestSequenceRef.current}`;
    try {
      committingRef.current = true;
      interaction.beginCommit({ requestId, viewId: editing.viewId, recordId, fieldId, value });
      await onUpdateCell(recordId, fieldId, value);
      const latest = useGridInteractionStore.getState();
      if (latest.pendingCommit?.requestId !== requestId) return;
      const shouldMove = latest.viewId === editing.viewId;
      const current = latest.selection ?? singleCell(editing.point);
      interaction.completeCommit(requestId);
      if (shouldMove) {
        const next = direction ? moveSelection(current, direction, data.records.length, layouts.length) : current;
        interaction.setSelection(next);
        scrollToPoint(next.active);
        scrollRef.current?.focus({ preventScroll: true });
      }
    } catch (error) {
      interaction.failCommit(requestId, error instanceof Error ? error.message : "保存失败，请重试。");
    } finally {
      committingRef.current = false;
    }
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || !data.records.length || !layouts.length) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey && onUndo) {
      event.preventDefault();
      void onUndo().then(() => setOperationToast("已撤销上次操作")).catch((error: unknown) => setOperationFailure({ message: error instanceof Error ? error.message : "撤销失败。", retry: () => undefined }));
      return;
    }
    const selection = interaction.selection ?? singleCell({ row: 0, column: 0 });
    const point = selection.active;
    const field = layouts[point.column]?.field;
    const direction = directionForKey(event.key, event.shiftKey, false);
    if (direction) { event.preventDefault(); const next = moveSelection(selection, direction, data.records.length, layouts.length, event.shiftKey && event.key.startsWith("Arrow")); interaction.setSelection(next); scrollToPoint(next.active); return; }
    if (event.key === "Enter") { event.preventDefault(); startEditing(point); return; }
    if (event.key === "Delete") { event.preventDefault(); void applyClear(); return; }
    if (event.key === " ") { event.preventDefault(); if (field?.fieldType === "checkbox") void toggleCheckbox(point); else interaction.setNotice("Space 只用于切换复选框字段。"); return; }
    if (field && isPrintableKey(event.nativeEvent)) { event.preventDefault(); startEditing(point, event.key); }
  }

  function handleGridCopy(event: ClipboardEvent<HTMLElement>) {
    const selection = useGridInteractionStore.getState().selection;
    if (!selection) return;
    const copied = selectionClipboard(selection, layouts.map((layout) => layout.field), data.records);
    event.preventDefault();
    event.clipboardData.setData("text/plain", clipboardText(copied, layouts.map((layout) => layout.field)));
    event.clipboardData.setData(MORFRA_CLIPBOARD_MIME, serializeMorfraClipboard(copied));
    const activeField = layouts[selection.active.column]?.field;
    interaction.setNotice(copied.values.length === 1 && copied.fieldIds.length === 1 && activeField ? `已复制第 ${selection.active.row + 1} 行${activeField.name}。` : `已复制 ${copied.values.length} 行 × ${copied.fieldIds.length} 列。`);
  }

  function handleGridPaste(event: ClipboardEvent<HTMLElement>) {
    const selection = useGridInteractionStore.getState().selection;
    if (!selection) return;
    event.preventDefault();
    const internal = parseMorfraClipboard(event.clipboardData.getData(MORFRA_CLIPBOARD_MIME));
    const plan = internal ? buildPastePlan(data, layouts.map((layout) => layout.field), selection, internal) : externalPastePlan(data, layouts.map((layout) => layout.field), selection, event.clipboardData.getData("text/plain"));
    void applyPlan(plan, "已粘贴内容");
  }

  async function applyPlan(plan: PastePlan | Error, summary: string, deleteRecordIds: string[] = []) {
    if (plan instanceof Error) { interaction.setNotice(plan.message); return; }
    if (!onApplyTableMutation) { interaction.setNotice("当前运行环境不支持批量表格操作。"); return; }
    try {
      setOperationFailure(null);
      await onApplyTableMutation(data.tableId, plan, deleteRecordIds);
      setOperationToast(summary);
      interaction.setNotice(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "自动保存失败，数据未被修改。";
      setOperationFailure({ message, retry: () => void applyPlan(plan, summary, deleteRecordIds) });
    }
  }

  function applyClear() {
    const selection = useGridInteractionStore.getState().selection;
    if (!selection) return;
    void applyPlan(buildClearPlan(data, layouts.map((layout) => layout.field), selection), "已清空所选单元格");
  }

  async function copySelectionToSystem() {
    const selection = useGridInteractionStore.getState().selection;
    if (!selection) return;
    const copied = selectionClipboard(selection, layouts.map((layout) => layout.field), data.records);
    try { await navigator.clipboard.writeText(clipboardText(copied, layouts.map((layout) => layout.field))); interaction.setNotice(`已复制 ${copied.values.length} 行 × ${copied.fieldIds.length} 列。`); }
    catch { interaction.setNotice("复制失败，请使用 ⌘C。"); }
  }

  async function pasteFromSystem() {
    try {
      const text = await navigator.clipboard.readText();
      const selection = useGridInteractionStore.getState().selection;
      if (selection) await applyPlan(externalPastePlan(data, layouts.map((layout) => layout.field), selection, text), "已粘贴内容");
    } catch { interaction.setNotice("无法读取剪贴板，请使用 ⌘V。"); }
  }

  function toggleCheckbox(point: GridPoint) {
    if (useGridInteractionStore.getState().pendingCommit) { interaction.setNotice("存在未落盘修改，请先重试或放弃草稿。"); return; }
    const field = layouts[point.column]?.field;
    const record = data.records[point.row];
    if (!field || !record || field.fieldType !== "checkbox") return;
    selectCell(point, false);
    const originalValue = valueForCell(field, record);
    interaction.startEditing({ viewId, direct: true, point, recordId: record.id, fieldId: field.id, originalValue, draft: originalValue !== true });
    void commitEditing();
  }

  function stopEditingAndFocus() {
    interaction.stopEditing();
    scrollRef.current?.focus({ preventScroll: true });
  }

  function openCellContextMenu(point: GridPoint, event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    const selection = useGridInteractionStore.getState().selection;
    if (!containsCell(selection, point)) interaction.setSelection(singleCell(point));
    setContextMenu({ x: event.clientX, y: event.clientY, point, rows: false });
  }

  function openRowContextMenu(row: number, event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    const selection = useGridInteractionStore.getState().selection;
    if (!selection?.rows.includes(row)) interaction.setSelection({ active: { row, column: selection?.active.column ?? 0 }, range: { anchor: { row, column: selection?.active.column ?? 0 }, focus: { row, column: selection?.active.column ?? 0 } }, rows: [row] });
    setContextMenu({ x: event.clientX, y: event.clientY, point: { row, column: selection?.active.column ?? 0 }, rows: true });
  }

  function applyUniformValue(value: JsonValue) {
    const selection = useGridInteractionStore.getState().selection;
    if (!selection) return;
    const field = layouts[selection.active.column]?.field;
    if (!field || selection.rows.length || !onApplyTableMutation) return;
    const reason = editableFieldReason(field);
    if (reason) { interaction.setNotice(reason); return; }
    if (typeof value === "number" && !Number.isFinite(value)) { interaction.setNotice("请输入有效数字。"); return; }
    const bounds = rangeBounds(selection.range);
    if (bounds.left !== bounds.right) { interaction.setNotice("统一设置值仅适用于同一字段的多选单元格。"); return; }
    const updates = Array.from({ length: bounds.bottom - bounds.top + 1 }, (_, index) => data.records[bounds.top + index]).filter((record): record is RecordData => Boolean(record)).map((record) => ({ recordId: record.id, fieldId: field.id, value }));
    void applyPlan({ updates, newRecords: [] }, `已统一设置 ${updates.length} 个值`);
  }

  function confirmDeleteRows() {
    const selection = useGridInteractionStore.getState().selection;
    const deleteRecordIds = selection?.rows.map((row) => data.records[row]?.id).filter((id): id is string => Boolean(id)) ?? [];
    setDeleteCount(0);
    if (deleteRecordIds.length) void applyPlan({ updates: [], newRecords: [] }, `已删除 ${deleteRecordIds.length} 条记录`, deleteRecordIds);
  }

  return <section className="morfra-data-grid" aria-label={`表格画布，${table.getRowModel().rows.length} 条记录`} style={gridStyle}>
    <div className="morfra-grid-controls"><span>{data.records.length} 条记录 · {layouts.length} 个可见字段</span><div><label>行高<select aria-label="行高" value={config.rowHeight} onChange={(event) => update({ rowHeight: Number(event.target.value) as GridLayoutConfig["rowHeight"] })}><option value="32">紧凑</option><option value="40">标准</option><option value="56">宽松</option></select></label><button type="button" className="morfra-grid-add-record" onClick={onCreate}>新建记录</button></div></div>
    <div className="morfra-grid-scroll" ref={scrollRef} role="grid" tabIndex={0} aria-rowcount={data.records.length} aria-colcount={layouts.length} aria-activedescendant={interaction.selection ? `${gridId}-cell-${interaction.selection.active.row}-${interaction.selection.active.column}` : undefined} aria-label="可编辑表格" onScroll={(event) => { if (interaction.editing && layouts[interaction.editing.point.column]?.frozen) setScrollLeft(event.currentTarget.scrollLeft); }} onKeyDown={handleGridKeyDown} onCopy={handleGridCopy} onPaste={handleGridPaste}>
      <GridHeader layouts={layouts} groupNames={groupNames} rowHeight={config.rowHeight} collapsedGroupIds={config.collapsedGroupIds} onToggleGroup={(groupId) => update({ collapsedGroupIds: config.collapsedGroupIds.includes(groupId) ? config.collapsedGroupIds.filter((id) => id !== groupId) : [...config.collapsedGroupIds, groupId] })} onReorderGroup={(sourceId, targetId) => { const groupOrder = moveGroup(config.groupOrder, sourceId, targetId); update({ groupOrder, fieldIds: orderGridFieldIdsByGroup(config.fieldIds, data.fields, groupOrder) }); }} onResize={(fieldId, nextWidth) => { const field = data.fields.find((item) => item.id === fieldId); if (field) update({ columnWidths: { ...config.columnWidths, [fieldId]: clampColumnWidth(field, nextWidth) } }); }} onAutoFit={(fieldId) => { const field = data.fields.find((item) => item.id === fieldId); if (!field) return; const longest = Math.max(field.name.length, ...renderedRecordsRef.current.map((record) => String(record.values[fieldId] ?? record.multiSelectValues[fieldId]?.length ?? "").length)); update({ columnWidths: { ...config.columnWidths, [fieldId]: clampColumnWidth(field, longest * 8 + 48) } }); }} onFreezeTo={(fieldId) => update({ frozenFieldId: fieldId })} onClearExtraFreeze={() => update({ frozenFieldId: null })} />
      {data.records.length ? <GridBody gridId={gridId} parentRef={scrollRef} layouts={layouts} records={data.records} rowHeight={config.rowHeight} selection={interaction.selection} editing={currentEditing?.point ?? null} onOpenDetail={onOpenDetail} onRenderedRecordsChange={updateRenderedRecords} onSelectCell={selectCell} onExtendSelection={(point) => { const current = useGridInteractionStore.getState().selection; if (current && !current.rows.length) { interaction.setSelection(moveActive(current, point, true)); scrollToPoint(point); } }} onSelectRows={(selection) => { interaction.setSelection(selection); scrollRef.current?.focus({ preventScroll: true }); }} onStartEditing={startEditing} onContextCell={openCellContextMenu} onContextRow={openRowContextMenu} onToggleCheckbox={toggleCheckbox} /> : <div className="morfra-grid-empty-state">还没有记录，请使用上方“新建记录”开始录入。</div>}
      <GridPersistentEditor editing={currentEditing} layouts={layouts} records={data.records} rowHeight={config.rowHeight} scrollLeft={scrollLeft} error={interaction.error} onChange={interaction.setDraft} onCommit={(direction) => void commitEditing(direction)} onCancel={stopEditingAndFocus} />
    </div>
    <div className="morfra-grid-announcement" aria-live="polite">{interaction.saving ? "正在保存修改…" : interaction.error ?? interaction.notice}{interaction.error && interaction.pendingCommit && <><button type="button" onClick={() => void commitEditing()}>重试保存</button><button type="button" onClick={stopEditingAndFocus}>放弃草稿</button></>}</div>
    {contextMenu && <GridContextMenu x={contextMenu.x} y={contextMenu.y} field={layouts[contextMenu.point.column]?.field ?? null} rowSelected={contextMenu.rows} canClear={!(buildClearPlan(data, layouts.map((layout) => layout.field), useGridInteractionStore.getState().selection ?? singleCell(contextMenu.point)) instanceof Error)} {...uniformValueAvailability(useGridInteractionStore.getState().selection, layouts.map((layout) => layout.field))} onCopy={() => { void copySelectionToSystem(); setContextMenu(null); }} onPaste={() => { void pasteFromSystem(); setContextMenu(null); }} onClear={() => { applyClear(); setContextMenu(null); }} onDeleteRows={() => { setDeleteCount(useGridInteractionStore.getState().selection?.rows.length ?? 0); setContextMenu(null); }} onOpenDetail={() => { const record = data.records[contextMenu.point.row]; if (record) onOpenDetail(record.id); setContextMenu(null); }} onSetValue={applyUniformValue} onClose={() => setContextMenu(null)} />}
    {deleteCount > 0 && <BulkDeleteDialog count={deleteCount} onCancel={() => setDeleteCount(0)} onConfirm={confirmDeleteRows} />}
    {operationFailure && <div className="morfra-grid-operation-error" role="alert">自动保存失败：{operationFailure.message}<button type="button" onClick={operationFailure.retry}>重试</button></div>}
    {operationToast && <div className="morfra-grid-operation-toast" role="status">{operationToast}<button type="button" onClick={() => { if (onUndo) void onUndo().then(() => setOperationToast(null)).catch((error: unknown) => setOperationFailure({ message: error instanceof Error ? error.message : "撤销失败。", retry: () => undefined })); }}>撤销</button><button type="button" aria-label="关闭操作提示" onClick={() => setOperationToast(null)}>×</button></div>}
  </section>;
}

function normalizeValue(field: FieldSummary, draft: JsonValue): JsonValue | Error {
  if (field.fieldType === "multi_select") return Array.isArray(draft) ? draft.filter((item): item is string => typeof item === "string") : [];
  if (field.fieldType === "checkbox") return draft === true;
  if (field.fieldType === "number" || field.fieldType === "progress") {
    const text = String(draft ?? "").trim();
    if (!text) return null;
    const number = Number(text);
    if (!Number.isFinite(number)) return new Error("请输入有效数字。");
    if (field.fieldType === "progress" && (number < 0 || number > 100)) return new Error("进度必须介于 0 到 100。");
    return number;
  }
  if (field.fieldType === "select") return typeof draft === "string" && draft ? draft : null;
  return typeof draft === "string" ? draft.trim() || null : draft;
}

function orderedFields(fields: FieldSummary[], groups: TableDataSnapshot["groups"], fieldIds: string[], collapsedGroups: string[]): FieldSummary[] { const lookup = new Map(fields.map((field) => [field.id, field])); const groupNames = new Map(groups.map((group) => [group.id, group.name])); const visible = fieldIds.map((id) => lookup.get(id)).filter((field): field is FieldSummary => Boolean(field)); const title = visible.find((field) => field.isTitle); const inserted = new Set<string>(); const rest = visible.flatMap((field) => { if (!field.groupId || !collapsedGroups.includes(field.groupId)) return [field]; if (inserted.has(field.groupId)) return []; inserted.add(field.groupId); const count = visible.filter((item) => item.groupId === field.groupId).length; return [{ ...field, id: `collapsed:${field.groupId}`, name: `${groupNames.get(field.groupId) ?? "字段组"} · ${count} 个字段`, fieldType: "text" as const }]; }); return title ? [title, ...rest.filter((field) => !field.isTitle)] : rest; }

export function parseGridLayout(config: JsonValue, fields: FieldSummary[], groups: FieldGroupSummary[] = []): GridLayoutConfig { const source = isRecord(config) ? config : {}; const groupOrder = normalizeGridGroupOrder(Array.isArray(source.groupOrder) ? source.groupOrder : null, fields, groups); const fieldIds = orderGridFieldIdsByGroup(normalizeGridFieldIds(Array.isArray(source.fieldIds) ? source.fieldIds : null, fields), fields, groupOrder); const widths = isRecord(source.columnWidths) ? Object.fromEntries(Object.entries(source.columnWidths).filter((entry): entry is [string, number] => typeof entry[1] === "number")) : {}; const frozenFieldId = typeof source.frozenFieldId === "string" ? source.frozenFieldId : null; const rowHeight = source.rowHeight === 32 || source.rowHeight === 56 ? source.rowHeight : 40; const collapsedGroupIds = Array.isArray(source.collapsedGroupIds) ? source.collapsedGroupIds.filter((id): id is string => typeof id === "string") : []; return { fieldIds, groupOrder, columnWidths: widths, frozenFieldId, rowHeight, collapsedGroupIds }; }
export function normalizeGridFieldIds(ids: readonly unknown[] | null | undefined, fields: FieldSummary[]): string[] { const allFieldIds = fields.map((field) => field.id); if (!ids?.length) return allFieldIds; const knownIds = new Set(allFieldIds); const uniqueIds = [...new Set(ids.filter((id): id is string => typeof id === "string" && knownIds.has(id)))]; const titleId = fields.find((field) => field.isTitle)?.id; return titleId ? [titleId, ...uniqueIds.filter((id) => id !== titleId)] : uniqueIds; }
export function normalizeGridGroupOrder(ids: readonly unknown[] | null | undefined, fields: FieldSummary[], groups: FieldGroupSummary[]): string[] { const defaults = [...[...groups].sort((left, right) => left.position - right.position).map((group) => group.id), ...fields.filter((field) => !field.isTitle).map((field) => field.groupId ?? "ungrouped")]; const validIds = new Set(defaults); const requested = ids?.filter((id): id is string => typeof id === "string" && validIds.has(id)) ?? []; return [...new Set([...requested, ...defaults])]; }
function moveGroup(order: string[], sourceId: string, targetId: string): string[] { const next = [...order]; const from = next.indexOf(sourceId); const to = next.indexOf(targetId); if (from < 0 || to < 0) return order; const [source] = next.splice(from, 1); next.splice(to, 0, source); return next; }
export function orderGridFieldIdsByGroup(fieldIds: string[], fields: FieldSummary[], groupOrder: string[]): string[] { const byId = new Map(fields.map((field) => [field.id, field])); const titleIds = fieldIds.filter((id) => byId.get(id)?.isTitle); const grouped = groupOrder.flatMap((groupId) => fieldIds.filter((id) => { const field = byId.get(id); return field && !field.isTitle && (field.groupId ?? "ungrouped") === groupId; })); const orderedIds = new Set([...titleIds, ...grouped]); return [...titleIds, ...grouped, ...fieldIds.filter((id) => !orderedIds.has(id))]; }
function isRecord(value: JsonValue): value is Record<string, JsonValue> { return typeof value === "object" && value !== null && !Array.isArray(value); }
export function nextGridScrollTop(rowTop: number, rowBottom: number, scrollTop: number, clientHeight: number): number {
  if (rowTop < scrollTop + GRID_HEADER_HEIGHT) return Math.max(0, rowTop - GRID_HEADER_HEIGHT);
  if (rowBottom > scrollTop + clientHeight) return Math.max(0, rowBottom - clientHeight);
  return scrollTop;
}

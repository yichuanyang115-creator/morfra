import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from "react";
import { buildColumnLayouts, clampColumnWidth, stickyOffset } from "../../lib/table/columnLayout";
import { clipboardText, MORFRA_CLIPBOARD_MIME, parseMorfraClipboard, selectionClipboard, serializeMorfraClipboard } from "../../lib/table/clipboard";
import { directionForKey, isPrintableKey, moveSelection, type GridDirection } from "../../lib/table/keyboardNavigation";
import { buildClearPlan, buildPastePlan, externalPastePlan, type PastePlan } from "../../lib/table/pastePlan";
import { containsCell, moveActive, rangeBounds, singleCell, type GridPoint } from "../../lib/table/selectionModel";
import { useGridInteractionStore } from "../../stores/gridInteractionStore";
import type { FieldSummary, JsonValue, RecordData, TableDataSnapshot } from "../../types/domain";
import { editableFieldReason, isReadOnlyField, valueForCell } from "./cellValue";
import { GridBody } from "./GridBody";
import { GridHeader } from "./GridHeader";
import { BulkDeleteDialog } from "./BulkDeleteDialog";
import { GridContextMenu, uniformValueAvailability } from "./GridContextMenu";
import { GridPersistentEditor } from "./GridPersistentEditor";
import { EMPTY_VIEW_PIPELINE, type RecordGroupMeta } from "../../lib/table/viewPipeline";
import type { ProjectedGroup } from "../../lib/table/groupProjection";
import { buildGroupedRowTops, nextGridScrollTop, normalizeGridValue, orderedFields, type GridLayoutConfig } from "./gridConfig";
import { useStableRowSelection } from "./useStableRowSelection";
export { nextGridScrollTop, normalizeGridFieldIds, normalizeGridValue, parseGridLayout, type GridLayoutConfig } from "./gridConfig";
export { GridLoadingSkeleton as DataGridLoadingSkeleton } from "./GridLoadingSkeleton";

interface DataGridProps { viewId: string; data: TableDataSnapshot; config: GridLayoutConfig; recordGroups?: RecordGroupMeta[]; groups?: ProjectedGroup[]; groupField?: FieldSummary; onConfigChange: (config: GridLayoutConfig) => void; onOpenDetail: (recordId: string) => void; onSelectionChange?: (recordIds: string[]) => void; onCreate?: () => void; onCreateField?: (fieldType: FieldSummary["fieldType"], name: string) => Promise<string>; onRenameField?: (fieldId: string, name: string) => Promise<void>; onCreateInGroup?: (key: string) => void; onUpdateCell: (recordId: string, fieldId: string, value: JsonValue) => Promise<unknown>; onApplyTableMutation?: (tableId: string, plan: PastePlan, deleteRecordIds?: string[]) => Promise<unknown>; onUndo?: () => Promise<unknown>; }

export function DataGrid({ viewId, data, config, recordGroups, groups = [], groupField, onConfigChange, onOpenDetail, onSelectionChange, onCreateField, onRenameField, onCreateInGroup, onUpdateCell, onApplyTableMutation, onUndo }: DataGridProps) {
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
  const visibleFields = useMemo(() => orderedFields(data.fields, config.fieldIds), [config.fieldIds, data.fields]);
  const layouts = useMemo(() => buildColumnLayouts(visibleFields, config.columnWidths, config.frozenFieldId, width), [config.columnWidths, config.frozenFieldId, visibleFields, width]);
  const table = useReactTable<RecordData>({ data: data.records, columns: layouts.map((layout) => ({ id: layout.field.id, accessorFn: (row) => row.values[layout.field.id] })), getCoreRowModel: getCoreRowModel() });
  const rowTops = useMemo(() => buildGroupedRowTops(data.records.length, recordGroups, config.rowHeight, Boolean(groupField && !isReadOnlyField(groupField))), [config.rowHeight, data.records.length, groupField, recordGroups]);
  const { clearStableSelection, applyRowSelection } = useStableRowSelection({ viewId, records: data.records, onSelectionChange, focusGrid: () => scrollRef.current?.focus({ preventScroll: true }) });
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
    const top = 40 + (rowTops[point.row] ?? point.row * config.rowHeight);
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
    clearStableSelection();
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
      const normalized = normalizeGridValue(field, editing.draft);
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
    if (!selection?.rows.includes(row)) applyRowSelection({ active: { row, column: selection?.active.column ?? 0 }, range: { anchor: { row, column: selection?.active.column ?? 0 }, focus: { row, column: selection?.active.column ?? 0 } }, rows: [row] });
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
    <div className="morfra-grid-scroll" ref={scrollRef} role="grid" tabIndex={0} aria-rowcount={data.records.length} aria-colcount={layouts.length} aria-activedescendant={interaction.selection ? `${gridId}-cell-${interaction.selection.active.row}-${interaction.selection.active.column}` : undefined} aria-label="可编辑表格" onScroll={(event) => { if (interaction.editing && layouts[interaction.editing.point.column]?.frozen) setScrollLeft(event.currentTarget.scrollLeft); }} onKeyDown={handleGridKeyDown} onCopy={handleGridCopy} onPaste={handleGridPaste}>
      <GridHeader layouts={layouts} rowHeight={config.rowHeight} onCreateField={onCreateField} onRenameField={onRenameField} onResize={(fieldId, nextWidth) => { const field = data.fields.find((item) => item.id === fieldId); if (field) update({ columnWidths: { ...config.columnWidths, [fieldId]: clampColumnWidth(field, nextWidth) } }); }} onAutoFit={(fieldId) => { const field = data.fields.find((item) => item.id === fieldId); if (!field) return; const longest = Math.max(field.name.length, ...renderedRecordsRef.current.map((record) => String(record.values[fieldId] ?? record.multiSelectValues[fieldId]?.length ?? "").length)); update({ columnWidths: { ...config.columnWidths, [fieldId]: clampColumnWidth(field, longest * 8 + 48) } }); }} onFreezeTo={(fieldId) => update({ frozenFieldId: fieldId })} onClearExtraFreeze={() => update({ frozenFieldId: null })} />
      {data.records.length || groups.length ? <GridBody key={groupField?.id ?? "flat"} gridId={gridId} parentRef={scrollRef} layouts={layouts} records={data.records} rowHeight={config.rowHeight} conditionalColors={config.pipeline?.conditionalColors} recordGroups={recordGroups} groups={groups} collapsedKeys={config.pipeline?.group.collapsedKeys ?? []} rowTops={rowTops} onToggleGroup={(key) => { const current = config.pipeline?.group ?? EMPTY_VIEW_PIPELINE.group; const collapsedKeys = current.collapsedKeys.includes("__all__") ? groups.filter((group) => group.key !== key).map((group) => group.key) : current.collapsedKeys.includes(key) ? current.collapsedKeys.filter((item) => item !== key) : [...current.collapsedKeys, key]; update({ pipeline: { ...(config.pipeline ?? EMPTY_VIEW_PIPELINE), group: { ...current, collapsedKeys } } }); }} onCreateInGroup={groupField && !isReadOnlyField(groupField) ? onCreateInGroup : undefined} selection={interaction.selection} editing={currentEditing?.point ?? null} onOpenDetail={onOpenDetail} onRenderedRecordsChange={updateRenderedRecords} onSelectCell={selectCell} onExtendSelection={(point) => { const current = useGridInteractionStore.getState().selection; if (current && !current.rows.length) { interaction.setSelection(moveActive(current, point, true)); scrollToPoint(point); } }} onSelectRows={applyRowSelection} onStartEditing={startEditing} onContextCell={openCellContextMenu} onContextRow={openRowContextMenu} onToggleCheckbox={toggleCheckbox} /> : <div className="morfra-grid-empty-state">还没有符合当前视图条件的记录。</div>}
      <GridPersistentEditor editing={currentEditing} layouts={layouts} records={data.records} rowHeight={config.rowHeight} rowTops={rowTops} scrollLeft={scrollLeft} error={interaction.error} onChange={interaction.setDraft} onCommit={(direction) => void commitEditing(direction)} onCancel={stopEditingAndFocus} />
    </div>
    <div className="morfra-grid-announcement" aria-live="polite">{interaction.saving ? "正在保存修改…" : interaction.error ?? interaction.notice}{interaction.error && interaction.pendingCommit && <><button type="button" onClick={() => void commitEditing()}>重试保存</button><button type="button" onClick={stopEditingAndFocus}>放弃草稿</button></>}</div>
    {contextMenu && <GridContextMenu x={contextMenu.x} y={contextMenu.y} field={layouts[contextMenu.point.column]?.field ?? null} rowSelected={contextMenu.rows} canClear={!(buildClearPlan(data, layouts.map((layout) => layout.field), useGridInteractionStore.getState().selection ?? singleCell(contextMenu.point)) instanceof Error)} {...uniformValueAvailability(useGridInteractionStore.getState().selection, layouts.map((layout) => layout.field))} onCopy={() => { void copySelectionToSystem(); setContextMenu(null); }} onPaste={() => { void pasteFromSystem(); setContextMenu(null); }} onClear={() => { applyClear(); setContextMenu(null); }} onDeleteRows={() => { setDeleteCount(useGridInteractionStore.getState().selection?.rows.length ?? 0); setContextMenu(null); }} onOpenDetail={() => { const record = data.records[contextMenu.point.row]; if (record) onOpenDetail(record.id); setContextMenu(null); }} onSetValue={applyUniformValue} onClose={() => setContextMenu(null)} />}
    {deleteCount > 0 && <BulkDeleteDialog count={deleteCount} onCancel={() => setDeleteCount(0)} onConfirm={confirmDeleteRows} />}
    {operationFailure && <div className="morfra-grid-operation-error" role="alert">自动保存失败：{operationFailure.message}<button type="button" onClick={operationFailure.retry}>重试</button></div>}
    {operationToast && <div className="morfra-grid-operation-toast" role="status">{operationToast}<button type="button" onClick={() => { if (onUndo) void onUndo().then(() => setOperationToast(null)).catch((error: unknown) => setOperationFailure({ message: error instanceof Error ? error.message : "撤销失败。", retry: () => undefined })); }}>撤销</button><button type="button" aria-label="关闭操作提示" onClick={() => setOperationToast(null)}>×</button></div>}
  </section>;
}

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { ROW_NUMBER_WIDTH, type ColumnLayout } from "../../lib/table/columnLayout";
import { containsCell, selectRows, type GridPoint, type GridSelection } from "../../lib/table/selectionModel";
import type { RecordData } from "../../types/domain";
import { GridCell } from "./GridCell";
import { GridSelectionLayer } from "./GridSelectionLayer";
import { matchesCondition, type ConditionalColorRule, type RecordGroupMeta } from "../../lib/table/viewPipeline";
import type { ProjectedGroup } from "../../lib/table/groupProjection";
import { valueForCell } from "./cellValue";

interface GridBodyProps {
  gridId: string;
  parentRef: RefObject<HTMLDivElement | null>;
  layouts: ColumnLayout[];
  records: RecordData[];
  rowHeight: number;
  selection: GridSelection | null;
  editing: GridPoint | null;
  onOpenDetail: (recordId: string) => void;
  onRenderedRecordsChange: (records: RecordData[]) => void;
  onSelectCell: (point: GridPoint, extend: boolean) => void;
  onExtendSelection: (point: GridPoint) => void;
  onSelectRows: (selection: GridSelection) => void;
  onStartEditing: (point: GridPoint) => void;
  onContextCell: (point: GridPoint, event: React.MouseEvent<HTMLElement>) => void;
  onContextRow?: (row: number, event: React.MouseEvent<HTMLElement>) => void;
  onToggleCheckbox: (point: GridPoint) => void;
  conditionalColors?: ConditionalColorRule[];
  recordGroups?: RecordGroupMeta[];
  emptyGroups?: ProjectedGroup[];
  canMoveGroups?: boolean;
  canReorderRows?: boolean;
  onCreateInGroup?: (key: string) => void;
  onMoveToGroup?: (recordId: string, sourceKey: string, targetKey: string) => void;
  onReorderWithinGroup?: (recordId: string, targetRecordId: string) => void;
  rowTops?: number[];
}

const GROUP_HEADER_HEIGHT = 32;
const GROUP_FOOTER_HEIGHT = 28;

export function GridBody({ gridId, parentRef, layouts, records, rowHeight, selection, editing, onOpenDetail, onRenderedRecordsChange, onSelectCell, onExtendSelection, onSelectRows, onStartEditing, onContextCell, onContextRow, onToggleCheckbox, conditionalColors = [], recordGroups = [], emptyGroups = [], canMoveGroups = false, canReorderRows = false, onCreateInGroup, onMoveToGroup, onReorderWithinGroup, rowTops }: GridBodyProps) {
  const [dragged, setDragged] = useState<{ recordId: string; groupKey: string } | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const grouped = recordGroups.length === records.length;
  const itemSize = (index: number) => rowHeight + (grouped && recordGroups[index]?.first ? GROUP_HEADER_HEIGHT : 0) + (grouped && recordGroups[index]?.last && onCreateInGroup ? GROUP_FOOTER_HEIGHT : 0);
  const rowVirtualizer = useVirtualizer({ count: records.length, getScrollElement: () => parentRef.current, estimateSize: itemSize, overscan: 4 });
  const columnVirtualizer = useVirtualizer({ horizontal: true, count: layouts.length, getScrollElement: () => parentRef.current, estimateSize: (index) => layouts[index]?.width ?? 0, overscan: 3 });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();
  useEffect(() => { onRenderedRecordsChange(virtualRows.map((item) => records[item.index]).filter((record): record is RecordData => Boolean(record))); }, [onRenderedRecordsChange, records, virtualRows]);
  const renderedColumns = [...new Set([...layouts.map((layout, index) => layout.frozen ? index : -1).filter((index) => index >= 0), ...virtualColumns.map((item) => item.index)])].sort((left, right) => left - right);
  const recordsHeight = rowVirtualizer.getTotalSize();
  const emptyGroupHeight = GROUP_HEADER_HEIGHT + (onCreateInGroup ? GROUP_FOOTER_HEIGHT : 0);
  return <div className="morfra-grid-body" style={{ height: recordsHeight + emptyGroups.length * emptyGroupHeight }}>
    <GridSelectionLayer selection={selection} layouts={layouts} rowHeight={rowHeight} rowTops={rowTops} />
    {virtualRows.map((virtualRow) => {
      const record = records[virtualRow.index];
      const group = grouped ? recordGroups[virtualRow.index] : undefined;
      const contentTop = group?.first ? GROUP_HEADER_HEIGHT : 0;
      return <div key={`${record.id}:${group?.key ?? "flat"}`} role="row" aria-rowindex={virtualRow.index + 1} className={`morfra-grid-row ${dragTargetId === record.id ? "is-drag-target" : ""}`} data-row-index={virtualRow.index} draggable={Boolean(group && (canMoveGroups || canReorderRows))} onDragStart={() => { if (group) setDragged({ recordId: record.id, groupKey: group.key }); }} onDragOver={(event) => { if (group && (canMoveGroups || canReorderRows)) { event.preventDefault(); setDragTargetId(record.id); } }} onDrop={(event) => { event.stopPropagation(); if (dragged && group && dragged.recordId !== record.id) { if (dragged.groupKey === group.key && canReorderRows) onReorderWithinGroup?.(dragged.recordId, record.id); else if (dragged.groupKey !== group.key && canMoveGroups) onMoveToGroup?.(dragged.recordId, dragged.groupKey, group.key); } setDragged(null); setDragTargetId(null); }} onDragEnd={() => { setDragged(null); setDragTargetId(null); }} style={{ gridTemplateColumns: gridTemplate(layouts), height: itemSize(virtualRow.index), transform: `translateY(${virtualRow.start}px)` }}>
        {group?.first && <div className="morfra-record-group-header" style={{ height: GROUP_HEADER_HEIGHT }} onDragOver={(event) => { if (canMoveGroups) event.preventDefault(); }} onDrop={(event) => { event.stopPropagation(); if (dragged && dragged.groupKey !== group.key) onMoveToGroup?.(dragged.recordId, dragged.groupKey, group.key); setDragged(null); }}><strong>{group.label}</strong><span>{group.count} 条记录</span></div>}
        <div className="morfra-grid-record-row" style={{ top: contentTop, height: rowHeight }}>
        <div role="rowheader" className={`morfra-grid-row-number morfra-grid-sticky ${selection?.rows.includes(virtualRow.index) ? "is-selected" : ""}`} onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          event.preventDefault();
          onSelectRows(selectRows(selection, virtualRow.index, event.metaKey ? "toggle" : event.shiftKey ? "range" : "single"));
        }} onPointerEnter={(event) => { if (event.buttons === 1 && selection?.rows.length) onSelectRows(selectRows(selection, virtualRow.index, "range")); }} onContextMenu={(event) => onContextRow?.(virtualRow.index, event)}>{group && (canMoveGroups || canReorderRows) && <button type="button" className="morfra-grid-row-drag" aria-label={`拖动第 ${virtualRow.index + 1} 条记录`} draggable onDragStart={(event) => { event.stopPropagation(); setDragged({ recordId: record.id, groupKey: group.key }); }} onDragEnd={() => { setDragged(null); setDragTargetId(null); }}>⠿</button>}<span>{virtualRow.index + 1}</span><button type="button" aria-label={`打开第 ${virtualRow.index + 1} 条记录详情`} onClick={(event) => { event.stopPropagation(); onOpenDetail(record.id); }}>↗</button></div>
        {renderedColumns.map((columnIndex) => {
          const layout = layouts[columnIndex];
          const virtualColumn = virtualColumns.find((item) => item.index === columnIndex);
          const left = layouts.slice(0, columnIndex).reduce((sum, item) => sum + item.width, 0);
          const point = { row: virtualRow.index, column: columnIndex };
          const selected = containsCell(selection, point);
          const active = selection?.active.row === point.row && selection.active.column === point.column;
          const isEditing = editing?.row === point.row && editing.column === point.column;
          const color = conditionalColors.find((rule) => rule.enabled && rule.fieldId === layout.field.id && matchesCondition(valueForCell(layout.field, record), rule.operator, rule.value))?.color;
          return <div key={layout.field.id} className={`morfra-grid-cell ${layout.frozen ? "is-frozen" : ""}`} data-column-index={columnIndex} style={layout.frozen ? { left: `var(--grid-sticky-${layout.field.id})`, width: layout.width } : { left: ROW_NUMBER_WIDTH + (virtualColumn?.start ?? left), width: layout.width }}><GridCell id={`${gridId}-cell-${point.row}-${point.column}`} field={layout.field} record={record} point={point} selected={selected} active={active} editing={isEditing} conditionalColor={color} readOnly={layout.field.id.startsWith("collapsed:") || ["auto_number", "created_time", "updated_time"].includes(layout.field.fieldType)} onPointerDown={(event) => { if (event.button !== 2) { event.preventDefault(); onSelectCell(point, event.shiftKey); } }} onPointerEnter={(event) => { if (event.buttons === 1) onExtendSelection(point); }} onDoubleClick={() => onStartEditing(point)} onContextMenu={(event) => onContextCell(point, event)} onToggleCheckbox={() => onToggleCheckbox(point)} /></div>;
        })}
        </div>
        {group?.last && onCreateInGroup && <div className="morfra-record-group-footer" style={{ top: contentTop + rowHeight, height: GROUP_FOOTER_HEIGHT }} onDragOver={(event) => { if (canMoveGroups) event.preventDefault(); }} onDrop={(event) => { event.stopPropagation(); if (dragged && dragged.groupKey !== group.key) onMoveToGroup?.(dragged.recordId, dragged.groupKey, group.key); setDragged(null); }}><button type="button" onClick={() => onCreateInGroup(group.key)}>＋ 在“{group.label}”中新建记录</button></div>}
      </div>;
    })}
    {emptyGroups.map((group, index) => <div key={`empty:${group.key}`} className="morfra-empty-record-group" style={{ transform: `translateY(${recordsHeight + index * emptyGroupHeight}px)`, height: emptyGroupHeight }}>
      <div className="morfra-record-group-header" style={{ height: GROUP_HEADER_HEIGHT }} onDragOver={(event) => { if (canMoveGroups) event.preventDefault(); }} onDrop={() => { if (dragged && dragged.groupKey !== group.key) onMoveToGroup?.(dragged.recordId, dragged.groupKey, group.key); setDragged(null); }}><strong>{group.label}</strong><span>0 条记录</span></div>
      {onCreateInGroup && <div className="morfra-record-group-footer" style={{ top: GROUP_HEADER_HEIGHT, height: GROUP_FOOTER_HEIGHT }}><button type="button" onClick={() => onCreateInGroup(group.key)}>＋ 在“{group.label}”中新建记录</button></div>}
    </div>)}
  </div>;
}

function gridTemplate(layouts: ColumnLayout[]): CSSProperties["gridTemplateColumns"] { return `68px ${layouts.map((layout) => `${layout.width}px`).join(" ")}`; }

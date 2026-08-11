import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect } from "react";
import type { CSSProperties, RefObject } from "react";
import { ROW_NUMBER_WIDTH, type ColumnLayout } from "../../lib/table/columnLayout";
import { containsCell, selectRows, type GridPoint, type GridSelection } from "../../lib/table/selectionModel";
import type { RecordData } from "../../types/domain";
import { GridCell } from "./GridCell";
import { GridSelectionLayer } from "./GridSelectionLayer";

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
}

export function GridBody({ gridId, parentRef, layouts, records, rowHeight, selection, editing, onOpenDetail, onRenderedRecordsChange, onSelectCell, onExtendSelection, onSelectRows, onStartEditing, onContextCell, onContextRow, onToggleCheckbox }: GridBodyProps) {
  const rowVirtualizer = useVirtualizer({ count: records.length, getScrollElement: () => parentRef.current, estimateSize: () => rowHeight, overscan: 4 });
  const columnVirtualizer = useVirtualizer({ horizontal: true, count: layouts.length, getScrollElement: () => parentRef.current, estimateSize: (index) => layouts[index]?.width ?? 0, overscan: 3 });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();
  useEffect(() => { onRenderedRecordsChange(virtualRows.map((item) => records[item.index]).filter((record): record is RecordData => Boolean(record))); }, [onRenderedRecordsChange, records, virtualRows]);
  const renderedColumns = [...new Set([...layouts.map((layout, index) => layout.frozen ? index : -1).filter((index) => index >= 0), ...virtualColumns.map((item) => item.index)])].sort((left, right) => left - right);
  return <div className="morfra-grid-body" style={{ height: rowVirtualizer.getTotalSize() }}>
    <GridSelectionLayer selection={selection} layouts={layouts} rowHeight={rowHeight} />
    {virtualRows.map((virtualRow) => {
      const record = records[virtualRow.index];
      return <div key={record.id} role="row" aria-rowindex={virtualRow.index + 1} className="morfra-grid-row" data-row-index={virtualRow.index} style={{ gridTemplateColumns: gridTemplate(layouts), height: rowHeight, transform: `translateY(${virtualRow.start}px)` }}>
        <div role="rowheader" className={`morfra-grid-row-number morfra-grid-sticky ${selection?.rows.includes(virtualRow.index) ? "is-selected" : ""}`} onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          event.preventDefault();
          onSelectRows(selectRows(selection, virtualRow.index, event.metaKey ? "toggle" : event.shiftKey ? "range" : "single"));
        }} onPointerEnter={(event) => { if (event.buttons === 1 && selection?.rows.length) onSelectRows(selectRows(selection, virtualRow.index, "range")); }} onContextMenu={(event) => onContextRow?.(virtualRow.index, event)}><span>{virtualRow.index + 1}</span><button type="button" aria-label={`打开第 ${virtualRow.index + 1} 条记录详情`} onClick={(event) => { event.stopPropagation(); onOpenDetail(record.id); }}>↗</button></div>
        {renderedColumns.map((columnIndex) => {
          const layout = layouts[columnIndex];
          const virtualColumn = virtualColumns.find((item) => item.index === columnIndex);
          const left = layouts.slice(0, columnIndex).reduce((sum, item) => sum + item.width, 0);
          const point = { row: virtualRow.index, column: columnIndex };
          const selected = containsCell(selection, point);
          const active = selection?.active.row === point.row && selection.active.column === point.column;
          const isEditing = editing?.row === point.row && editing.column === point.column;
          return <div key={layout.field.id} className={`morfra-grid-cell ${layout.frozen ? "is-frozen" : ""}`} data-column-index={columnIndex} style={layout.frozen ? { left: `var(--grid-sticky-${layout.field.id})`, width: layout.width } : { left: ROW_NUMBER_WIDTH + (virtualColumn?.start ?? left), width: layout.width }}><GridCell id={`${gridId}-cell-${point.row}-${point.column}`} field={layout.field} record={record} point={point} selected={selected} active={active} editing={isEditing} readOnly={layout.field.id.startsWith("collapsed:") || ["auto_number", "created_time", "updated_time"].includes(layout.field.fieldType)} onPointerDown={(event) => { if (event.button !== 2) { event.preventDefault(); onSelectCell(point, event.shiftKey); } }} onPointerEnter={(event) => { if (event.buttons === 1) onExtendSelection(point); }} onDoubleClick={() => onStartEditing(point)} onContextMenu={(event) => onContextCell(point, event)} onToggleCheckbox={() => onToggleCheckbox(point)} /></div>;
        })}
      </div>;
    })}
  </div>;
}

function gridTemplate(layouts: ColumnLayout[]): CSSProperties["gridTemplateColumns"] { return `68px ${layouts.map((layout) => `${layout.width}px`).join(" ")}`; }

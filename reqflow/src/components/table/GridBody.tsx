import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect } from "react";
import type { CSSProperties, RefObject } from "react";
import { ROW_NUMBER_WIDTH, type ColumnLayout } from "../../lib/table/columnLayout";
import type { RecordData } from "../../types/domain";
import { GridCell } from "./GridCell";

interface GridBodyProps { parentRef: RefObject<HTMLDivElement | null>; layouts: ColumnLayout[]; records: RecordData[]; rowHeight: number; onOpenDetail: (recordId: string) => void; onRenderedRecordsChange: (records: RecordData[]) => void; }

export function GridBody({ parentRef, layouts, records, rowHeight, onOpenDetail, onRenderedRecordsChange }: GridBodyProps) {
  const rowVirtualizer = useVirtualizer({ count: records.length, getScrollElement: () => parentRef.current, estimateSize: () => rowHeight, overscan: 4 });
  const columnVirtualizer = useVirtualizer({ horizontal: true, count: layouts.length, getScrollElement: () => parentRef.current, estimateSize: (index) => layouts[index]?.width ?? 0, overscan: 3 });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();
  useEffect(() => { onRenderedRecordsChange(virtualRows.map((item) => records[item.index]).filter((record): record is RecordData => Boolean(record))); }, [onRenderedRecordsChange, records, virtualRows]);
  const renderedColumns = [...new Set([...layouts.map((layout, index) => layout.frozen ? index : -1).filter((index) => index >= 0), ...virtualColumns.map((item) => item.index)])].sort((left, right) => left - right);
  return <div className="morfra-grid-body" style={{ height: rowVirtualizer.getTotalSize() }}>
    {virtualRows.map((virtualRow) => { const record = records[virtualRow.index]; return <div key={record.id} className="morfra-grid-row" data-row-index={virtualRow.index} style={{ gridTemplateColumns: gridTemplate(layouts), height: rowHeight, transform: `translateY(${virtualRow.start}px)` }}>
      <div className="morfra-grid-row-number morfra-grid-sticky"><span>{virtualRow.index + 1}</span><button type="button" aria-label={`打开第 ${virtualRow.index + 1} 条记录详情`} onClick={() => onOpenDetail(record.id)}>↗</button></div>
      {renderedColumns.map((columnIndex) => { const layout = layouts[columnIndex]; const virtualColumn = virtualColumns.find((item) => item.index === columnIndex); const left = layouts.slice(0, columnIndex).reduce((sum, item) => sum + item.width, 0); return <div key={layout.field.id} className={`morfra-grid-cell ${layout.frozen ? "is-frozen" : ""}`} data-column-index={columnIndex} style={layout.frozen ? { left: `var(--grid-sticky-${layout.field.id})`, width: layout.width } : { left: ROW_NUMBER_WIDTH + (virtualColumn?.start ?? left), width: layout.width }}><GridCell field={layout.field} record={record} /></div>; })}
    </div>; })}
  </div>;
}

function gridTemplate(layouts: ColumnLayout[]): CSSProperties["gridTemplateColumns"] { return `68px ${layouts.map((layout) => `${layout.width}px`).join(" ")}`; }

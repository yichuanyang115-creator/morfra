import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect } from "react";
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
  groups?: ProjectedGroup[];
  collapsedKeys?: string[];
  onToggleGroup?: (key: string) => void;
  onCreateInGroup?: (key: string) => void;
  rowTops?: number[];
}

const GROUP_HEADER_HEIGHT = 32;
const GROUP_FOOTER_HEIGHT = 28;

export function GridBody({ gridId, parentRef, layouts, records, rowHeight, selection, editing, onOpenDetail, onRenderedRecordsChange, onSelectCell, onExtendSelection, onSelectRows, onStartEditing, onContextCell, onContextRow, onToggleCheckbox, conditionalColors = [], recordGroups = [], groups = [], collapsedKeys = [], onToggleGroup, onCreateInGroup, rowTops }: GridBodyProps) {
  const grouped = recordGroups.length === records.length;
  const itemSize = (index: number) => (grouped && recordGroups[index]?.collapsed ? 0 : rowHeight) + (grouped && recordGroups[index]?.first ? GROUP_HEADER_HEIGHT : 0) + (grouped && recordGroups[index]?.last && onCreateInGroup && !recordGroups[index]?.collapsed ? GROUP_FOOTER_HEIGHT : 0);
  const rowVirtualizer = useVirtualizer({ count: records.length, getScrollElement: () => parentRef.current, estimateSize: itemSize, overscan: 4 });
  const columnVirtualizer = useVirtualizer({ horizontal: true, count: layouts.length, getScrollElement: () => parentRef.current, estimateSize: (index) => layouts[index]?.width ?? 0, overscan: 3 });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();
  useEffect(() => { onRenderedRecordsChange(virtualRows.map((item) => records[item.index]).filter((record): record is RecordData => Boolean(record))); }, [onRenderedRecordsChange, records, virtualRows]);
  const renderedColumns = [...new Set([...layouts.map((layout, index) => layout.frozen ? index : -1).filter((index) => index >= 0), ...virtualColumns.map((item) => item.index)])].sort((left, right) => left - right);
  const recordsHeight = rowVirtualizer.getTotalSize();
  const emptyGroups = groups.filter((group) => group.count === 0);
  const emptyGroupHeight = GROUP_HEADER_HEIGHT + (onCreateInGroup ? GROUP_FOOTER_HEIGHT : 0);
  return <div className="morfra-grid-body" style={{ height: recordsHeight + emptyGroups.length * emptyGroupHeight }}>
    <GridSelectionLayer selection={selection} layouts={layouts} rowHeight={rowHeight} rowTops={rowTops} />
    {virtualRows.map((virtualRow) => {
      const record = records[virtualRow.index];
      const group = grouped ? recordGroups[virtualRow.index] : undefined;
      const contentTop = group?.first ? GROUP_HEADER_HEIGHT : 0;
      return <div key={`${record.id}:${group?.key ?? "flat"}`} role="row" aria-rowindex={virtualRow.index + 1} className="morfra-grid-row" data-row-index={virtualRow.index} style={{ width: gridWidth(layouts), height: itemSize(virtualRow.index), transform: `translateY(${virtualRow.start}px)` }}>
        {group?.first && <GroupHeader group={group} onToggle={onToggleGroup} />}
        {!group?.collapsed && <div className="morfra-grid-record-row" style={{ gridTemplateColumns: gridTemplate(layouts), top: contentTop, height: rowHeight }}>
        <div role="rowheader" className={`morfra-grid-row-number morfra-grid-sticky ${selection?.rows.includes(virtualRow.index) ? "is-selected" : ""}`} onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          event.preventDefault();
          onSelectRows(selectRows(selection, virtualRow.index, event.metaKey ? "toggle" : event.shiftKey ? "range" : "single"));
        }} onPointerEnter={(event) => { if (event.buttons === 1 && selection?.rows.length) onSelectRows(selectRows(selection, virtualRow.index, "range")); }} onContextMenu={(event) => onContextRow?.(virtualRow.index, event)}><span>{virtualRow.index + 1}</span></div>
        {renderedColumns.map((columnIndex) => {
          const layout = layouts[columnIndex];
          const virtualColumn = virtualColumns.find((item) => item.index === columnIndex);
          const left = layouts.slice(0, columnIndex).reduce((sum, item) => sum + item.width, 0);
          const point = { row: virtualRow.index, column: columnIndex };
          const selected = containsCell(selection, point);
          const active = selection?.active.row === point.row && selection.active.column === point.column;
          const isEditing = editing?.row === point.row && editing.column === point.column;
          const color = conditionalColors.find((rule) => rule.enabled && rule.fieldId === layout.field.id && matchesCondition(valueForCell(layout.field, record), rule.operator, rule.value))?.color;
          return <div key={layout.field.id} className={`morfra-grid-cell ${layout.frozen ? "is-frozen" : ""}`} data-column-index={columnIndex} style={layout.frozen ? { left: `var(--grid-sticky-${layout.field.id})`, width: layout.width } : { left: ROW_NUMBER_WIDTH + (virtualColumn?.start ?? left), width: layout.width }}><GridCell id={`${gridId}-cell-${point.row}-${point.column}`} field={layout.field} record={record} point={point} selected={selected} active={active} editing={isEditing} conditionalColor={color} readOnly={layout.field.id.startsWith("collapsed:") || ["auto_number", "created_time", "updated_time"].includes(layout.field.fieldType)} onPointerDown={(event) => { if (event.button !== 2) { event.preventDefault(); onSelectCell(point, event.shiftKey); } }} onPointerEnter={(event) => { if (event.buttons === 1) onExtendSelection(point); }} onDoubleClick={() => onStartEditing(point)} onContextMenu={(event) => onContextCell(point, event)} onToggleCheckbox={() => onToggleCheckbox(point)} onOpenDetail={layout.field.isTitle ? () => onOpenDetail(record.id) : undefined} detailLabel={`打开第 ${virtualRow.index + 1} 条记录详情`} /></div>;
        })}
        </div>}
        {group?.last && onCreateInGroup && <div className="morfra-record-group-footer" style={{ top: contentTop + rowHeight, height: GROUP_FOOTER_HEIGHT }}><button type="button" onClick={() => onCreateInGroup(group.key)}>＋ 在“{group.label}”中新建记录</button></div>}
      </div>;
    })}
    {emptyGroups.map((group, index) => <div key={`empty:${group.key}`} className="morfra-empty-record-group" style={{ transform: `translateY(${recordsHeight + index * emptyGroupHeight}px)`, height: emptyGroupHeight }}>
      <GroupHeader group={{ ...group, collapsed: collapsedKeys.includes("__all__") || collapsedKeys.includes(group.key) }} onToggle={onToggleGroup} />
      {onCreateInGroup && !(collapsedKeys.includes("__all__") || collapsedKeys.includes(group.key)) && <div className="morfra-record-group-footer" style={{ top: GROUP_HEADER_HEIGHT, height: GROUP_FOOTER_HEIGHT }}><button type="button" onClick={() => onCreateInGroup(group.key)}>＋ 在“{group.label}”中新建记录</button></div>}
    </div>)}
  </div>;
}

function GroupHeader({ group, onToggle }: { group: Pick<ProjectedGroup, "key" | "label" | "count"> & { collapsed?: boolean }; onToggle?: (key: string) => void }) {
  return <div className="morfra-record-group-header" style={{ height: GROUP_HEADER_HEIGHT }}><button type="button" aria-label={`${group.label}分组`} aria-expanded={!group.collapsed} onClick={() => onToggle?.(group.key)}>{group.collapsed ? "›" : "⌄"}</button><strong>{group.label}</strong><span>{group.count} 条记录</span></div>;
}

function gridTemplate(layouts: ColumnLayout[]): CSSProperties["gridTemplateColumns"] { return `${ROW_NUMBER_WIDTH}px ${layouts.map((layout) => `${layout.width}px`).join(" ")}`; }
function gridWidth(layouts: ColumnLayout[]) { return ROW_NUMBER_WIDTH + layouts.reduce((sum, layout) => sum + layout.width, 0); }

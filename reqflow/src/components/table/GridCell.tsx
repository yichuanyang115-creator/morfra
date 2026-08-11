import type { FieldSummary, RecordData } from "../../types/domain";
import { formatCellValue, valueForCell } from "./cellValue";
import type { GridPoint } from "../../lib/table/selectionModel";

interface GridCellProps {
  id: string;
  field: FieldSummary;
  record: RecordData;
  point: GridPoint;
  selected: boolean;
  active: boolean;
  editing: boolean;
  readOnly: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerEnter: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onContextMenu: () => void;
  onToggleCheckbox: () => void;
}

export function GridCell({ id, field, record, point, selected, active, editing, readOnly, onPointerDown, onPointerEnter, onDoubleClick, onContextMenu, onToggleCheckbox }: GridCellProps) {
  const value = valueForCell(field, record);
  const state = `${selected ? "is-selected" : ""} ${active ? "is-active" : ""} ${editing ? "is-editing" : ""}`;
  const label = `第 ${point.row + 1} 行，${field.name}，${formatCellValue(field, value)}${readOnly ? "，只读" : ""}`;
  return <div id={id} className={`morfra-grid-cell-content ${state}`} role="gridcell" aria-colindex={point.column + 1} aria-label={label} aria-selected={selected} aria-readonly={readOnly || undefined} tabIndex={-1} onPointerDown={onPointerDown} onPointerEnter={onPointerEnter} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
    <CellDisplay field={field} value={value} onToggleCheckbox={onToggleCheckbox} onOpenEditor={onDoubleClick} />
  </div>;
}

function CellDisplay({ field, value, onToggleCheckbox, onOpenEditor }: { field: FieldSummary; value: import("../../types/domain").JsonValue; onToggleCheckbox: () => void; onOpenEditor: () => void }) {
  if (field.fieldType === "image" && typeof value === "string" && value) return <img className="morfra-grid-thumbnail" src={value} alt={`${field.name}缩略图`} />;
  if (field.fieldType === "file" && typeof value === "string" && value) return <span className="morfra-grid-file">{value.split("/").pop()}</span>;
  if (field.fieldType === "checkbox") return <button type="button" className="morfra-grid-checkbox" aria-label={`切换${field.name}`} aria-pressed={value === true} onClick={(event) => { event.stopPropagation(); onToggleCheckbox(); }}>{value === true ? "✓" : ""}</button>;
  if (["select", "multi_select", "date"].includes(field.fieldType)) return <><span>{formatCellValue(field, value)}</span><button type="button" className="morfra-grid-editor-trigger" aria-label={`编辑${field.name}`} onClick={(event) => { event.stopPropagation(); onOpenEditor(); }}>⌄</button></>;
  if (Array.isArray(value)) return <span>{value.length ? `${value.length} 项` : ""}</span>;
  if (value === null || value === undefined || value === "") return <span className="morfra-grid-empty">—</span>;
  if (typeof value === "boolean") return <span>{value ? "已勾选" : "未勾选"}</span>;
  return <span className={typeof value === "number" ? "morfra-grid-number" : "morfra-grid-text"}>{String(value)}</span>;
}

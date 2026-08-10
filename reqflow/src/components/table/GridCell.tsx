import type { FieldSummary, RecordData } from "../../types/domain";

interface GridCellProps { field: FieldSummary; record: RecordData; }

export function GridCell({ field, record }: GridCellProps) {
  const value = field.fieldType === "multi_select" ? record.multiSelectValues[field.id] : record.values[field.id];
  if (field.fieldType === "image" && typeof value === "string" && value) return <img className="morfra-grid-thumbnail" src={value} alt={`${field.name}缩略图`} />;
  if (field.fieldType === "file" && typeof value === "string" && value) return <span className="morfra-grid-file">{value.split("/").pop()}</span>;
  if (Array.isArray(value)) return <span>{value.length ? `${value.length} 项` : ""}</span>;
  if (value === null || value === undefined || value === "") return <span className="morfra-grid-empty">—</span>;
  if (typeof value === "boolean") return <span>{value ? "已勾选" : "未勾选"}</span>;
  return <span className={typeof value === "number" ? "morfra-grid-number" : "morfra-grid-text"}>{String(value)}</span>;
}

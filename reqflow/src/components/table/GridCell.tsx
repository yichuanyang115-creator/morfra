import type { FieldSummary, RecordData } from "../../types/domain";
import type { StorageAttachment } from "../../types/domain";
import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { listStorageAttachments, storageAttachmentPath } from "../../lib/ipc/storageClient";
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
  conditionalColor?: "gray" | "blue" | "green" | "yellow" | "red" | "purple";
  readOnly: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerEnter: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  onToggleCheckbox: () => void;
}

export function GridCell({ id, field, record, point, selected, active, editing, conditionalColor, readOnly, onPointerDown, onPointerEnter, onDoubleClick, onContextMenu, onToggleCheckbox }: GridCellProps) {
  const value = valueForCell(field, record);
  const state = `${selected ? "is-selected" : ""} ${active ? "is-active" : ""} ${editing ? "is-editing" : ""}`;
  const label = `第 ${point.row + 1} 行，${field.name}，${formatCellValue(field, value)}${readOnly ? "，只读" : ""}`;
  return <div id={id} className={`morfra-grid-cell-content ${conditionalColor ? `has-conditional-color color-${conditionalColor}` : ""} ${state}`} role="gridcell" aria-colindex={point.column + 1} aria-label={label} aria-selected={selected} aria-readonly={readOnly || undefined} tabIndex={-1} onPointerDown={onPointerDown} onPointerEnter={onPointerEnter} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
    <CellDisplay field={field} record={record} value={value} onToggleCheckbox={onToggleCheckbox} onOpenEditor={onDoubleClick} />
  </div>;
}

function CellDisplay({ field, record, value, onToggleCheckbox, onOpenEditor }: { field: FieldSummary; record: RecordData; value: import("../../types/domain").JsonValue; onToggleCheckbox: () => void; onOpenEditor: () => void }) {
  const attachments = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" && value ? [value] : [];
  if ((field.fieldType === "image" || field.fieldType === "file") && attachments.length) return <GridAttachments recordId={record.id} fieldId={field.id} image={field.fieldType === "image"} fallbackCount={attachments.length} />;
  if (field.fieldType === "checkbox") return <button type="button" className="morfra-grid-checkbox" aria-label={`切换${field.name}`} aria-pressed={value === true} onClick={(event) => { event.stopPropagation(); onToggleCheckbox(); }}>{value === true ? "✓" : ""}</button>;
  if (["select", "multi_select", "date"].includes(field.fieldType)) return <><span>{formatCellValue(field, value)}</span><button type="button" className="morfra-grid-editor-trigger" aria-label={`编辑${field.name}`} onClick={(event) => { event.stopPropagation(); onOpenEditor(); }}>⌄</button></>;
  if (Array.isArray(value)) return <span>{value.length ? `${value.length} 项` : ""}</span>;
  if (value === null || value === undefined || value === "") return <span className="morfra-grid-empty">—</span>;
  if (typeof value === "boolean") return <span>{value ? "已勾选" : "未勾选"}</span>;
  if (typeof value === "number" || ["created_time", "updated_time"].includes(field.fieldType)) return <span className={typeof value === "number" ? "morfra-grid-number" : "morfra-grid-text"}>{formatCellValue(field, value)}</span>;
  return <span className={typeof value === "number" ? "morfra-grid-number" : "morfra-grid-text"}>{String(value)}</span>;
}

function GridAttachments({ recordId, fieldId, image, fallbackCount }: { recordId: string; fieldId: string; image: boolean; fallbackCount: number }) {
  const [attachments, setAttachments] = useState<StorageAttachment[]>([]); const [missing, setMissing] = useState(false); const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { let active = true; void listStorageAttachments(recordId, fieldId).then((items) => { if (!active) return; setAttachments(items); if (image && items[0]) void storageAttachmentPath(items[0].id).then((path) => active && setPreview(convertFileSrc(path))).catch(() => active && setMissing(true)); }).catch(() => active && setMissing(true)); return () => { active = false; }; }, [fieldId, image, recordId]);
  const first = attachments[0]; const count = attachments.length || fallbackCount;
  if (!first) return <span className="morfra-grid-file">{missing ? "附件缺失" : `${count} 个附件`}</span>;
  return <span className="morfra-grid-attachments">{image && preview && !missing ? <img className="morfra-grid-thumbnail" src={preview} alt={`${first.originalName}缩略图`} onError={() => setMissing(true)} /> : <button type="button" className="morfra-grid-file" onClick={() => void storageAttachmentPath(first.id).then(openPath).catch(() => setMissing(true))}>{missing ? "附件缺失" : first.originalName}</button>}{count > 1 && <small>+{count - 1}</small>}</span>;
}

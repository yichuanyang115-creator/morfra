import type { FieldSummary, JsonValue, RecordData } from "../../types/domain";

export function valueForCell(field: FieldSummary, record: RecordData): JsonValue {
  return field.fieldType === "multi_select" ? record.multiSelectValues[field.id] ?? [] : record.values[field.id] ?? null;
}

export function formatCellValue(field: FieldSummary, value: JsonValue): string {
  if (value === null || value === "") return "空";
  if (field.fieldType === "multi_select" && Array.isArray(value)) return value.length ? `${value.length} 项` : "空";
  if (typeof value === "boolean") return value ? "已勾选" : "未勾选";
  return String(value);
}

export function isReadOnlyField(field: FieldSummary): boolean {
  return field.id.startsWith("collapsed:") || ["auto_number", "created_time", "updated_time"].includes(field.fieldType);
}

export function editableFieldReason(field: FieldSummary): string | null {
  if (field.id.startsWith("collapsed:")) return "请先展开字段组后编辑。";
  if (isReadOnlyField(field)) return `${field.name} 是自动维护字段，不能编辑。`;
  return null;
}

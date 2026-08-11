import type { FieldSummary, RecordData } from "../../types/domain";

export interface ProjectedGroup { key: string; label: string; recordIds: string[]; count: number; }

/** A multi-select record may appear in several groups, but this projection never duplicates its total. */
export function buildGroupProjection(records: RecordData[], field: FieldSummary, direction: "asc" | "desc"): ProjectedGroup[] {
  const groups = new Map<string, ProjectedGroup>();
  const add = (key: string, label: string, record: RecordData) => { const group = groups.get(key) ?? { key, label, recordIds: [], count: 0 }; group.recordIds.push(record.id); group.count += 1; groups.set(key, group); };
  if (field.fieldType === "select" || field.fieldType === "multi_select") for (const option of field.options) groups.set(option.id, { key: option.id, label: option.name, recordIds: [], count: 0 });
  for (const record of records) {
    const values = field.fieldType === "multi_select" ? record.multiSelectValues[field.id] ?? [] : [groupKey(record, field)];
    if (!values.length) add("__empty__", "未分组", record);
    else for (const value of values) add(value, labelFor(value, field), record);
  }
  if (!groups.has("__empty__")) groups.set("__empty__", { key: "__empty__", label: "未分组", recordIds: [], count: 0 });
  const ordered = [...groups.values()].sort((left, right) => naturalPosition(left.key, field) - naturalPosition(right.key, field) || left.label.localeCompare(right.label));
  const empty = ordered.find((group) => group.key === "__empty__");
  const valued = ordered.filter((group) => group.key !== "__empty__");
  return [...(direction === "desc" ? valued.reverse() : valued), ...(empty ? [empty] : [])];
}

export function uniqueProjectedRecordCount(groups: ProjectedGroup[]): number { return new Set(groups.flatMap((group) => group.recordIds)).size; }
export function isGroupable(field: FieldSummary): boolean { return !field.isTitle && !["image", "file", "auto_number"].includes(field.fieldType); }

function labelFor(value: string, field: FieldSummary): string { if (value === "__empty__") return "未分组"; return field.fieldType === "select" || field.fieldType === "multi_select" ? field.options.find((option) => option.id === value)?.name ?? value : value; }
function groupKey(record: RecordData, field: FieldSummary): string { const value = field.fieldType === "created_time" ? record.createdAt || record.values[field.id] || null : field.fieldType === "updated_time" ? record.updatedAt || record.values[field.id] || null : record.values[field.id] ?? null; if (field.fieldType === "date" || field.fieldType === "created_time" || field.fieldType === "updated_time") return typeof value === "string" ? value.slice(0, 10) : "__empty__"; return value === null || value === "" ? "__empty__" : String(value); }
function naturalPosition(key: string, field: FieldSummary): number { if (key === "__empty__") return Number.MAX_SAFE_INTEGER; const option = field.options.find((item) => item.id === key); if (option) return option.position; if (field.fieldType === "checkbox") return key === "false" ? 0 : 1; const numeric = Number(key); return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER - 1; }

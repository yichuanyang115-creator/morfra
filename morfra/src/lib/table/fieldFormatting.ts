import type { FieldSummary, JsonValue } from "../../types/domain";

const NUMBER_FORMATTER = new Intl.NumberFormat();
const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export function formatUserValue(field: FieldSummary, value: JsonValue): string {
  if (value === null || value === "" || Array.isArray(value) && value.length === 0) return "空";
  if (field.fieldType === "multi_select" && Array.isArray(value)) return value.length ? `${value.length} 项` : "空";
  if ((field.fieldType === "image" || field.fieldType === "file") && Array.isArray(value)) return `${value.length} 个附件`;
  if (typeof value === "boolean") return value ? "已勾选" : "未勾选";
  if (typeof value === "number") {
    const formatted = NUMBER_FORMATTER.format(value);
    const format = configValue(field, "format");
    return field.fieldType === "progress" || format === "percent" ? `${formatted}%` : format === "currency" ? `¤${formatted}` : formatted;
  }
  if (typeof value === "string" && ["date", "created_time", "updated_time"].includes(field.fieldType)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return configValue(field, "includeTime") === true || field.fieldType !== "date" ? DATE_TIME_FORMATTER.format(parsed) : DATE_FORMATTER.format(parsed);
  }
  return String(value);
}

function configValue(field: FieldSummary, key: string): JsonValue | undefined { return field.config && typeof field.config === "object" && !Array.isArray(field.config) ? field.config[key] : undefined; }

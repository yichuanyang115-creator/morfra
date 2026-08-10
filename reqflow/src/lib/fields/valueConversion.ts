import type { FieldType, JsonValue, TableDataSnapshot } from "../../types/domain";

export interface ConversionPreview {
  fieldId: string;
  fromType: FieldType;
  toType: FieldType;
  recordCount: number;
  convertedCount: number;
  clearedCount: number;
  generatedOptions: string[];
}

function asText(value: JsonValue | undefined, fieldType: FieldType, optionNames: Map<string, string>, multiValues: string[]): string | null {
  if (value === undefined || value === null) return null;
  if (fieldType === "multi_select") return multiValues.map((id) => optionNames.get(id) ?? id).join(", ") || null;
  if (fieldType === "select") return typeof value === "string" ? optionNames.get(value) ?? value : null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function canConvertText(text: string | null, nextType: FieldType): boolean {
  if (text === null) return true;
  if (["text", "image", "file", "link", "date"].includes(nextType)) return true;
  if (nextType === "number" || nextType === "progress") return Number.isFinite(Number(text)) && (nextType !== "progress" || (Number(text) >= 0 && Number(text) <= 100));
  if (nextType === "checkbox") return text === "true" || text === "false";
  if (["auto_number", "created_time", "updated_time"].includes(nextType)) return false;
  return true;
}

export function previewFieldConversion(data: TableDataSnapshot, fieldId: string, nextType: FieldType): ConversionPreview {
  const field = data.fields.find((candidate) => candidate.id === fieldId);
  if (!field) throw new Error("字段不存在");
  const optionNames = new Map(field.options.map((option) => [option.id, option.name]));
  const generated = new Set<string>();
  let convertedCount = 0;
  let clearedCount = 0;
  for (const record of data.records) {
    const raw = record.values[fieldId];
    const text = asText(raw, field.fieldType, optionNames, record.multiSelectValues[fieldId] ?? []);
    if ((nextType === "select" || nextType === "multi_select") && !["select", "multi_select"].includes(field.fieldType) && text !== null) generated.add(text);
    if (canConvertText(text, nextType)) convertedCount += 1;
    else clearedCount += 1;
  }
  return { fieldId, fromType: field.fieldType, toType: nextType, recordCount: data.records.length, convertedCount, clearedCount, generatedOptions: [...generated] };
}

export function convertTextValue(value: JsonValue | undefined, nextType: FieldType): JsonValue {
  if (value === undefined || value === null) return null;
  const text = typeof value === "string" ? value.trim() : String(value);
  if (text.length === 0) return null;
  if (nextType === "number" || nextType === "progress") { const number = Number(text); return Number.isFinite(number) && (nextType !== "progress" || (number >= 0 && number <= 100)) ? number : null; }
  if (nextType === "checkbox") return text === "true" ? true : text === "false" ? false : null;
  return text;
}

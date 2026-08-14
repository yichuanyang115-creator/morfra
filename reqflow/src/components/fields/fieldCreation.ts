import type { FieldType } from "../../types/domain";
import { FIELD_TYPE_LABELS } from "./FieldTypeIcon";

export const CREATABLE_FIELD_TYPES: FieldType[] = ["text", "number", "date", "select", "multi_select", "progress", "checkbox", "link", "image", "file"];

export function defaultFieldName(fieldType: FieldType): string {
  return FIELD_TYPE_LABELS[fieldType];
}

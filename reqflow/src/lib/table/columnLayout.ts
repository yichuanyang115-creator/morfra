import type { FieldSummary, FieldType } from "../../types/domain";

export const ROW_NUMBER_WIDTH = 48;
export const ADD_FIELD_COLUMN_WIDTH = 40;
export const MIN_SCROLLABLE_WIDTH = 280;

const DEFAULT_WIDTHS: Record<FieldType, number> = {
  text: 200, select: 200, multi_select: 200, link: 200, date: 160, created_time: 160,
  updated_time: 160, image: 180, file: 180, number: 120, progress: 120, checkbox: 120,
  auto_number: 120,
};

export interface ColumnLayout {
  field: FieldSummary;
  width: number;
  frozen: boolean;
}

export function defaultColumnWidth(field: FieldSummary): number {
  if (field.id.startsWith("collapsed:")) return 112;
  return field.isTitle ? 240 : DEFAULT_WIDTHS[field.fieldType];
}

export function clampColumnWidth(field: FieldSummary, width: number): number {
  return Math.max(field.isTitle ? 180 : 80, Math.min(600, Math.round(width)));
}

export function buildColumnLayouts(fields: FieldSummary[], widths: Record<string, number>, frozenFieldId: string | null, availableWidth: number): ColumnLayout[] {
  const frozenIndex = frozenFieldId ? fields.findIndex((field) => field.id === frozenFieldId) : -1;
  const requested = fields.map((field, index) => ({ field, width: field.isTitle && availableWidth < ROW_NUMBER_WIDTH + defaultColumnWidth(field) + MIN_SCROLLABLE_WIDTH ? 180 : clampColumnWidth(field, widths[field.id] ?? defaultColumnWidth(field)), frozen: field.isTitle || (frozenIndex >= 0 && index <= frozenIndex) }));
  let frozenWidth = ROW_NUMBER_WIDTH + requested.filter((item) => item.frozen).reduce((sum, item) => sum + item.width, 0);
  for (let index = requested.length - 1; index >= 0 && frozenWidth > Math.max(ROW_NUMBER_WIDTH + 180, availableWidth - MIN_SCROLLABLE_WIDTH); index -= 1) {
    if (requested[index].frozen && !requested[index].field.isTitle) { requested[index].frozen = false; frozenWidth -= requested[index].width; }
  }
  return requested;
}

export function stickyOffset(layouts: ColumnLayout[], fieldId: string): number {
  return ROW_NUMBER_WIDTH + layouts.slice(0, layouts.findIndex((item) => item.field.id === fieldId)).filter((item) => item.frozen).reduce((sum, item) => sum + item.width, 0);
}

import type { Attribute, Schema } from "../types/schema";

function sortByColumnOrder(attributes: Attribute[], columnOrder: string[]): Attribute[] {
  if (columnOrder.length === 0) return attributes;
  const orderIndex = new Map(columnOrder.map((id, i) => [id, i]));
  return attributes.slice().sort((a, b) => {
    const ia = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const ib = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
}

/**
 * 看板可见属性列表：showOnBoard 过滤 + 按 viewPreferences.columnOrder 排序（未配置过
 * 列序时该数组为空，此时保持 schema.attributes 的原始顺序，不重排）。Phase 19 起用户
 * 拖拽调序会写入 columnOrder，这里只读不写。
 */
export function boardAttributesFor(schema: Schema | null): Attribute[] {
  if (!schema) return [];
  const visible = schema.attributes.filter((a) => a.showOnBoard);
  return sortByColumnOrder(visible, schema.viewPreferences.columnOrder);
}

/**
 * 详情面板可见属性列表：showOnDetail 过滤，按 schema.attributes 原始定义顺序渲染
 * （REQ-004 MUST"属性区排序独立于看板列序"——不复用 columnOrder，天然与看板列序
 * 解耦。Schema 设置页尚未提供详情页专属排序配置，Phase 18 补齐后再接入独立排序）。
 */
export function detailAttributesFor(schema: Schema | null): Attribute[] {
  if (!schema) return [];
  return schema.attributes.filter((a) => a.showOnDetail);
}

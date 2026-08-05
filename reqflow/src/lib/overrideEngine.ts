import type { Attribute, AttributeOverride } from "../types/schema";

/**
 * 阶段覆盖引擎（Schema-自定义机制-讨论稿 §4.2）：某阶段下，一批列位属性被另一批属性替换
 * （占同一列位）。看板列头保持全局（列位顺序由 boardAttributesFor 决定），该阶段的行内
 * 被覆盖的列位显示替换属性。
 *
 * 优先级（§4.3）：覆盖先于依赖——这里先 resolve 出每个列位实际占位的属性，调用方再对该
 * 占位属性自身判断依赖。原属性（from）的依赖条件在被覆盖的阶段不生效。
 *
 * to 属性从全部属性索引解析：即使 to.showOnBoard 为 false（如系统预置计算属性在特定阶段
 * 才经覆盖显示），只要它在 schema.attributes 里就能占位。from 不在列位里（已隐藏）则该条
 * 覆盖对看板无作用，不额外报错。
 */
export function resolveStageOverrides(
  columnAttributes: Attribute[],
  allAttributesById: Map<string, Attribute>,
  overrides: AttributeOverride[] | undefined,
): Attribute[] {
  if (!overrides || overrides.length === 0) return columnAttributes;
  const byFrom = new Map<string, string>();
  for (const o of overrides) {
    if (o.fromAttributeId && o.toAttributeId) byFrom.set(o.fromAttributeId, o.toAttributeId);
  }
  if (byFrom.size === 0) return columnAttributes;
  return columnAttributes.map((a) => {
    const toId = byFrom.get(a.id);
    if (!toId) return a;
    return allAttributesById.get(toId) ?? a;
  });
}

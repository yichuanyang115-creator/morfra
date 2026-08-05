import type { Attribute } from "../types/schema";

/**
 * 属性依赖条件求值（Schema-自定义机制-讨论稿 §4.1）：属性 B 仅当依赖的属性 A 取配置值时
 * 才显示，纯 show/hide——看板按行空白（列始终存在，条件不满足的行该格子为空），详情页
 * 该属性不显示。无依赖条件（dependsOn 为空）恒满足。
 *
 * 取值语义：依赖源的当前值是数组（multiSelect）时按"包含该选项"匹配；其余类型严格相等
 * （singleSelect 存 optionId、text/date 存 string、number/percent 存 number、checkbox 存
 * boolean，配置侧按依赖源类型写入对应类型的 value，见 AttributeEditor 的依赖取值控件）。
 */
export function dependencySatisfied(attribute: Attribute, attributeValues: Record<string, unknown>): boolean {
  const dep = attribute.dependsOn;
  if (!dep) return true;
  const current = attributeValues[dep.attributeId];
  if (Array.isArray(current)) return current.includes(dep.value);
  return current === dep.value;
}

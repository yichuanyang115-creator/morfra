import type { Requirement } from "../types/models";
import type { Attribute, AttributeType } from "../types/schema";
import { convertAttributeValue, optionsForTypeChange } from "./attributeTypeConversion";

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
}

/** 该属性当前有多少条需求填了非空值（删属性二次确认的影响提示，见 Product-Spec REQ-025）。 */
export function countValuedAttribute(requirements: Requirement[], attributeId: string): number {
  return requirements.filter((r) => hasValue(r.attributeValues[attributeId])).length;
}

export interface TypeChangeImpact {
  totalCount: number;
  lostCount: number;
}

/** 改类型前统计有损影响条数（Product-Spec REQ-025："有损时弹确认告知影响条数"）。 */
export function typeChangeImpact(requirements: Requirement[], attribute: Attribute, toType: AttributeType): TypeChangeImpact {
  const toOptions = optionsForTypeChange(attribute, toType);
  let lostCount = 0;
  for (const r of requirements) {
    const { lost } = convertAttributeValue(r.attributeValues[attribute.id], attribute, toType, toOptions);
    if (lost) lostCount += 1;
  }
  return { totalCount: requirements.length, lostCount };
}

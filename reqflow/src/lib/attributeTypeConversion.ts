import type { Attribute, AttributeType, SelectOption } from "../types/schema";

/**
 * 改属性类型的有损判定 + 值转换（Schema-自定义机制-讨论稿 §7.1 转换表）：
 * Multi→Single 保留第一个值丢弃其余；Single→Multi 安全；Select→文本转纯文本（安全，
 * 无信息丢失）；文本→Select 匹配保留否则清空。未在表中列出的组合无法保证语义等价，
 * 按"清空"处理，原有值即算有损。computed 类型骨架属性禁止改类型（调用方拦截）。
 */

function optionLabel(options: SelectOption[] | undefined, id: unknown): string {
  return options?.find((o) => o.id === id)?.label ?? (typeof id === "string" ? id : "");
}

function emptyValueFor(type: AttributeType): unknown {
  switch (type) {
    case "multiSelect":
    case "attachment":
      return [];
    case "checkbox":
      return false;
    default:
      return null;
  }
}

export interface ConversionOutcome {
  value: unknown;
  /** 该条记录的这个值是否在转换中丢失了信息（用于统计有损改类型的影响条数）。 */
  lost: boolean;
}

export function convertAttributeValue(
  value: unknown,
  fromAttribute: Attribute,
  toType: AttributeType,
  toOptions: SelectOption[] | undefined,
): ConversionOutcome {
  const fromType = fromAttribute.type;
  if (fromType === toType) return { value, lost: false };

  if (fromType === "multiSelect" && toType === "singleSelect") {
    const arr = Array.isArray(value) ? value : [];
    return { value: arr[0] ?? null, lost: arr.length > 1 };
  }

  if (fromType === "singleSelect" && toType === "multiSelect") {
    return { value: value == null || value === "" ? [] : [value], lost: false };
  }

  if ((fromType === "singleSelect" || fromType === "multiSelect") && toType === "text") {
    if (fromType === "multiSelect") {
      const arr = Array.isArray(value) ? value : [];
      return { value: arr.map((v) => optionLabel(fromAttribute.options, v)).join(", "), lost: false };
    }
    return { value: value == null || value === "" ? "" : optionLabel(fromAttribute.options, value), lost: false };
  }

  if (fromType === "text" && (toType === "singleSelect" || toType === "multiSelect")) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return { value: emptyValueFor(toType), lost: false };
    const match = toOptions?.find((o) => o.label === text);
    if (!match) return { value: emptyValueFor(toType), lost: true };
    return { value: toType === "multiSelect" ? [match.id] : match.id, lost: false };
  }

  const hasValue = value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
  return { value: emptyValueFor(toType), lost: hasValue };
}

/** 目标类型是否需要携带选项列表（single/multi select）。改去其他类型时选项字段清空。 */
export function optionsForTypeChange(fromAttribute: Attribute, toType: AttributeType): SelectOption[] | undefined {
  if (toType === "singleSelect" || toType === "multiSelect") return fromAttribute.options ?? [];
  return undefined;
}

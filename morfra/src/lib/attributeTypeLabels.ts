import type { AttributeType } from "../types/schema";

export const ATTRIBUTE_TYPE_LABEL: Record<AttributeType, string> = {
  singleSelect: "单选",
  multiSelect: "多选",
  number: "数字",
  percent: "百分比",
  date: "日期",
  text: "文本",
  checkbox: "勾选",
  attachment: "附件",
  computed: "计算属性",
};

/** 用户可在设置页新建/改成的类型（骨架属性 Name/Stage 和系统预置计算属性不在此列，见 Product-Spec REQ-025）。 */
export const USER_ASSIGNABLE_TYPES: AttributeType[] = [
  "singleSelect",
  "multiSelect",
  "number",
  "percent",
  "date",
  "text",
  "checkbox",
  "attachment",
];

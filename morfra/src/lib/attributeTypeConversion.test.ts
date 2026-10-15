import { describe, expect, it } from "vitest";
import type { Attribute } from "../types/schema";
import { convertAttributeValue, optionsForTypeChange } from "./attributeTypeConversion";

function makeAttribute(overrides: Partial<Attribute>): Attribute {
  return { id: "a", name: "属性", type: "text", showOnBoard: true, showOnDetail: true, ...overrides };
}

const SELECT_OPTIONS = [
  { id: "p0", label: "P0" },
  { id: "p1", label: "P1" },
];

describe("convertAttributeValue", () => {
  it("同类型转换直接返回原值，不算有损", () => {
    const attribute = makeAttribute({ type: "text" });
    expect(convertAttributeValue("hello", attribute, "text", undefined)).toEqual({ value: "hello", lost: false });
  });

  it("Multi→Single 保留第一个值，多于一个值时算有损", () => {
    const attribute = makeAttribute({ type: "multiSelect", options: SELECT_OPTIONS });
    expect(convertAttributeValue(["p0", "p1"], attribute, "singleSelect", SELECT_OPTIONS)).toEqual({ value: "p0", lost: true });
  });

  it("Multi→Single 只有一个值时不算有损", () => {
    const attribute = makeAttribute({ type: "multiSelect", options: SELECT_OPTIONS });
    expect(convertAttributeValue(["p0"], attribute, "singleSelect", SELECT_OPTIONS)).toEqual({ value: "p0", lost: false });
  });

  it("Multi→Single 空数组转换为 null，不算有损", () => {
    const attribute = makeAttribute({ type: "multiSelect", options: SELECT_OPTIONS });
    expect(convertAttributeValue([], attribute, "singleSelect", SELECT_OPTIONS)).toEqual({ value: null, lost: false });
  });

  it("Single→Multi 安全转换，非空值变成单元素数组", () => {
    const attribute = makeAttribute({ type: "singleSelect", options: SELECT_OPTIONS });
    expect(convertAttributeValue("p0", attribute, "multiSelect", SELECT_OPTIONS)).toEqual({ value: ["p0"], lost: false });
  });

  it("Single→Multi 空值转换为空数组，不算有损", () => {
    const attribute = makeAttribute({ type: "singleSelect", options: SELECT_OPTIONS });
    expect(convertAttributeValue(null, attribute, "multiSelect", SELECT_OPTIONS)).toEqual({ value: [], lost: false });
  });

  it("Select→文本：选项 id 转成对应 label，不算有损", () => {
    const attribute = makeAttribute({ type: "singleSelect", options: SELECT_OPTIONS });
    expect(convertAttributeValue("p1", attribute, "text", undefined)).toEqual({ value: "P1", lost: false });
  });

  it("MultiSelect→文本：多个选项 label 用逗号拼接", () => {
    const attribute = makeAttribute({ type: "multiSelect", options: SELECT_OPTIONS });
    expect(convertAttributeValue(["p0", "p1"], attribute, "text", undefined)).toEqual({ value: "P0, P1", lost: false });
  });

  it("文本→Select：匹配到选项 label 时保留对应 id，不算有损", () => {
    const attribute = makeAttribute({ type: "text" });
    expect(convertAttributeValue("P0", attribute, "singleSelect", SELECT_OPTIONS)).toEqual({ value: "p0", lost: false });
  });

  it("文本→Select：不匹配任何选项时清空并算有损", () => {
    const attribute = makeAttribute({ type: "text" });
    expect(convertAttributeValue("不存在的值", attribute, "singleSelect", SELECT_OPTIONS)).toEqual({ value: null, lost: true });
  });

  it("文本→Select：空文本清空但不算有损（原本就没有值）", () => {
    const attribute = makeAttribute({ type: "text" });
    expect(convertAttributeValue("", attribute, "singleSelect", SELECT_OPTIONS)).toEqual({ value: null, lost: false });
  });

  it("未覆盖的转换组合（如数字→日期）：有值则清空并算有损", () => {
    const attribute = makeAttribute({ type: "number" });
    expect(convertAttributeValue(42, attribute, "date", undefined)).toEqual({ value: null, lost: true });
  });

  it("未覆盖的转换组合原值为空时清空但不算有损", () => {
    const attribute = makeAttribute({ type: "number" });
    expect(convertAttributeValue(null, attribute, "date", undefined)).toEqual({ value: null, lost: false });
  });

  it("转到 checkbox 类型时空值为 false", () => {
    const attribute = makeAttribute({ type: "text" });
    expect(convertAttributeValue(null, attribute, "checkbox", undefined)).toEqual({ value: false, lost: false });
  });

  it("转到 multiSelect/attachment 类型时空值为空数组", () => {
    const attribute = makeAttribute({ type: "text" });
    expect(convertAttributeValue(null, attribute, "attachment", undefined).value).toEqual([]);
  });
});

describe("optionsForTypeChange", () => {
  it("目标类型是 select 时携带原有选项", () => {
    const attribute = makeAttribute({ type: "singleSelect", options: SELECT_OPTIONS });
    expect(optionsForTypeChange(attribute, "multiSelect")).toEqual(SELECT_OPTIONS);
  });

  it("目标类型是 select 且原属性没有选项时给空数组", () => {
    const attribute = makeAttribute({ type: "text" });
    expect(optionsForTypeChange(attribute, "singleSelect")).toEqual([]);
  });

  it("目标类型不是 select 时返回 undefined（选项字段清空）", () => {
    const attribute = makeAttribute({ type: "singleSelect", options: SELECT_OPTIONS });
    expect(optionsForTypeChange(attribute, "text")).toBeUndefined();
  });
});

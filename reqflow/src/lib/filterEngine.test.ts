import { describe, expect, it } from "vitest";
import type { Attribute, FilterCondition } from "../types/schema";
import type { Requirement } from "../types/models";
import { operatorsFor, requirementMatchesFilters } from "./filterEngine";

function makeAttribute(overrides: Partial<Attribute>): Attribute {
  return { id: "a", name: "属性", type: "text", showOnBoard: true, showOnDetail: true, ...overrides };
}

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: "r-1",
    name: "需求一",
    stage: "design",
    createdAt: "2026-01-01T00:00:00.000Z",
    manualOrder: 0,
    body: "",
    attributeValues: {},
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

function cond(attributeId: string, operator: FilterCondition["operator"], value: unknown): FilterCondition {
  return { attributeId, operator, value };
}

describe("operatorsFor / FILTER_OPERATORS_BY_TYPE（REQ-026 运算符按类型区分）", () => {
  it("单选：=≠为空不为空", () => {
    expect(operatorsFor(makeAttribute({ type: "singleSelect" }))).toEqual(["eq", "neq", "is_empty", "is_not_empty"]);
  });
  it("多选/文本：包含不包含", () => {
    expect(operatorsFor(makeAttribute({ type: "multiSelect" }))).toEqual(["contains", "not_contains"]);
    expect(operatorsFor(makeAttribute({ type: "text" }))).toEqual(["contains", "not_contains"]);
  });
  it("数字/百分比：=≠><≥≤", () => {
    expect(operatorsFor(makeAttribute({ type: "number" }))).toEqual(["eq", "neq", "gt", "gte", "lt", "lte"]);
    expect(operatorsFor(makeAttribute({ type: "percent" }))).toEqual(["eq", "neq", "gt", "gte", "lt", "lte"]);
  });
  it("日期：= 之前 之后（REQ-026 日期含精确等号）；勾选：=≠", () => {
    expect(operatorsFor(makeAttribute({ type: "date" }))).toEqual(["eq", "before", "after"]);
    expect(operatorsFor(makeAttribute({ type: "checkbox" }))).toEqual(["eq", "neq"]);
  });
  it("附件：为空不为空", () => {
    expect(operatorsFor(makeAttribute({ type: "attachment" }))).toEqual(["is_empty", "is_not_empty"]);
  });
  it("computed 按 computedKind 映射：createdAt→日期比较，天数字段→数字比较", () => {
    expect(operatorsFor(makeAttribute({ type: "computed", computedKind: "createdAt" }))).toEqual(["eq", "before", "after"]);
    expect(operatorsFor(makeAttribute({ type: "computed", computedKind: "stayDays" }))).toEqual([
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
    ]);
  });
});

describe("requirementMatchesFilters（多条件 AND，REQ-026）", () => {
  const attributes: Attribute[] = [
    makeAttribute({ id: "priority", name: "优先级", type: "singleSelect", options: [{ id: "P1", label: "P1" }] }),
    makeAttribute({ id: "tags", name: "标签", type: "multiSelect" }),
    makeAttribute({ id: "progress", name: "进度", type: "number" }),
    makeAttribute({ id: "deadline", name: "截止", type: "date" }),
    makeAttribute({ id: "desc", name: "描述", type: "text" }),
    makeAttribute({ id: "flag", name: "标记", type: "checkbox" }),
  ];

  it("空条件列表恒可见（全量显示）", () => {
    expect(requirementMatchesFilters(makeRequirement(), attributes, [])).toBe(true);
  });

  it("单选 eq 匹配，neq 排除，is_empty/is_not_empty 判断未设置", () => {
    const r = makeRequirement({ attributeValues: { priority: "P1" } });
    expect(requirementMatchesFilters(r, attributes, [cond("priority", "eq", "P1")])).toBe(true);
    expect(requirementMatchesFilters(r, attributes, [cond("priority", "neq", "P1")])).toBe(false);
    expect(requirementMatchesFilters(makeRequirement(), attributes, [cond("priority", "is_empty", "")])).toBe(true);
    expect(requirementMatchesFilters(makeRequirement(), attributes, [cond("priority", "is_not_empty", "")])).toBe(false);
  });

  it("多选 contains：数组包含该选项；not_contains 反之", () => {
    const r = makeRequirement({ attributeValues: { tags: ["frontend", "backend"] } });
    expect(requirementMatchesFilters(r, attributes, [cond("tags", "contains", "frontend")])).toBe(true);
    expect(requirementMatchesFilters(r, attributes, [cond("tags", "not_contains", "ops")])).toBe(true);
    expect(requirementMatchesFilters(r, attributes, [cond("tags", "not_contains", "frontend")])).toBe(false);
  });

  it("数字比较 gt/gte/lt/lte，未设置值不满足数字比较", () => {
    const r = makeRequirement({ attributeValues: { progress: 80 } });
    expect(requirementMatchesFilters(r, attributes, [cond("progress", "gt", 50)])).toBe(true);
    expect(requirementMatchesFilters(r, attributes, [cond("progress", "gte", 80)])).toBe(true);
    expect(requirementMatchesFilters(r, attributes, [cond("progress", "lt", 80)])).toBe(false);
    expect(requirementMatchesFilters(makeRequirement(), attributes, [cond("progress", "gt", 50)])).toBe(false);
  });

  it("日期 before/after 按 YYYY-MM-DD 前缀比较", () => {
    const r = makeRequirement({ attributeValues: { deadline: "2026-08-15" } });
    expect(requirementMatchesFilters(r, attributes, [cond("deadline", "before", "2026-09-01")])).toBe(true);
    expect(requirementMatchesFilters(r, attributes, [cond("deadline", "after", "2026-08-01")])).toBe(true);
    expect(requirementMatchesFilters(r, attributes, [cond("deadline", "before", "2026-08-01")])).toBe(false);
  });

  it("日期 eq 精确匹配；computed createdAt 的 ISO 值按日期前缀匹配", () => {
    const r = makeRequirement({ attributeValues: { deadline: "2026-08-15" } });
    expect(requirementMatchesFilters(r, attributes, [cond("deadline", "eq", "2026-08-15")])).toBe(true);
    expect(requirementMatchesFilters(r, attributes, [cond("deadline", "eq", "2026-08-16")])).toBe(false);
    const createdAtAttr = makeAttribute({ id: "created", type: "computed", computedKind: "createdAt" });
    const r2 = makeRequirement({ createdAt: "2026-01-01T08:30:00.000Z" });
    expect(requirementMatchesFilters(r2, [createdAtAttr], [cond("created", "eq", "2026-01-01")])).toBe(true);
    expect(requirementMatchesFilters(r2, [createdAtAttr], [cond("created", "eq", "2026-01-02")])).toBe(false);
  });

  it("文本 contains/not_contains 子串匹配", () => {
    const r = makeRequirement({ attributeValues: { desc: "移动端登录优化" } });
    expect(requirementMatchesFilters(r, attributes, [cond("desc", "contains", "登录")])).toBe(true);
    expect(requirementMatchesFilters(r, attributes, [cond("desc", "not_contains", "登录")])).toBe(false);
  });

  it("勾选 eq/neq 布尔比较", () => {
    const r = makeRequirement({ attributeValues: { flag: true } });
    expect(requirementMatchesFilters(r, attributes, [cond("flag", "eq", true)])).toBe(true);
    expect(requirementMatchesFilters(r, attributes, [cond("flag", "eq", false)])).toBe(false);
    expect(requirementMatchesFilters(r, attributes, [cond("flag", "neq", false)])).toBe(true);
  });

  it("多条件 AND：全部满足才可见，任一不满足即排除", () => {
    const r = makeRequirement({ attributeValues: { priority: "P1", progress: 80 } });
    const both = [cond("priority", "eq", "P1"), cond("progress", "gt", 50)];
    expect(requirementMatchesFilters(r, attributes, both)).toBe(true);
    const oneFail = [cond("priority", "eq", "P1"), cond("progress", "gt", 90)];
    expect(requirementMatchesFilters(r, attributes, oneFail)).toBe(false);
  });

  it("computed totalDays 按数字比较求值（归档阶段冻结为创建到归档天数）", () => {
    const r = makeRequirement({
      stage: "archive",
      createdAt: "2026-01-01T00:00:00.000Z",
      transitions: [{ id: "t1", from: "design", to: "archive", timestamp: "2026-01-10T00:00:00.000Z", by: "user", note: "" }],
    });
    const computedAttr = makeAttribute({ id: "total", type: "computed", computedKind: "totalDays" });
    expect(requirementMatchesFilters(r, [computedAttr], [cond("total", "gte", 9)])).toBe(true);
    expect(requirementMatchesFilters(r, [computedAttr], [cond("total", "lt", 9)])).toBe(false);
  });

  it("未完成的草稿条件（attributeId 为空）不参与筛选", () => {
    const r = makeRequirement();
    expect(requirementMatchesFilters(r, attributes, [{ attributeId: "", operator: "eq", value: "P1" }])).toBe(true);
  });

  it("指向已删除属性的条件被忽略", () => {
    const r = makeRequirement({ attributeValues: { ghost: "x" } });
    expect(requirementMatchesFilters(r, attributes, [cond("ghost", "eq", "x")])).toBe(true);
  });
});

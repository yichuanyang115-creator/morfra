import { describe, expect, it } from "vitest";
import { AI_EVALUATION_TABLES } from "../../fixtures/aiEvaluationTables";
import { validateAnalysisPlan } from "./analysisPlan";

const delivery = AI_EVALUATION_TABLES[0];
const validPlan = {
  filters: [],
  projections: ["title"],
  groupBy: [],
  aggregates: [{ id: "count", operation: "count" }],
  sort: [],
  limit: 10,
};

describe("AIAnalysisPlan 运行时校验", () => {
  it("接受有限且字段存在的计划，并锁定整表记录范围", () => {
    const result = validateAnalysisPlan(validPlan, delivery);
    expect(result).toEqual({ ok: true, plan: validPlan, recordIds: ["delivery-1", "delivery-2", "delivery-3"] });
  });

  it("拒绝不存在字段、非法运算、无效选项和超大结果", () => {
    const invalid = validateAnalysisPlan({
      ...validPlan,
      projections: ["missing"],
      aggregates: [{ id: "bad", operation: "sum", fieldId: "title" }],
      filters: [{ fieldId: "status", operator: "equals", value: "missing" }],
      limit: 101,
    }, delivery);
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.issues.map((item) => item.code)).toEqual(expect.arrayContaining([
      "unknown-field",
      "invalid-operation",
      "invalid-value",
      "result-too-large",
    ]));
  });

  it("按字段类型拒绝非法操作组合", () => {
    const invalid = validateAnalysisPlan({
      ...validPlan,
      filters: [
        { fieldId: "dueDate", operator: "contains", value: "2026" },
        { fieldId: "title", operator: "greaterThan", value: "标题" },
      ],
    }, delivery);
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.issues.filter((item) => item.code === "invalid-operation")).toHaveLength(2);
  });

  it("拒绝没有明确语义的计算字段 contains 操作", () => {
    const mixed = {
      ...delivery,
      fields: [...delivery.fields, { id: "computed", name: "计算值", type: "computed" as const }],
      records: delivery.records.map((record) => ({ ...record, values: { ...record.values, computed: 1 } })),
    };
    const invalid = validateAnalysisPlan({
      ...validPlan,
      filters: [{ fieldId: "computed", operator: "contains", value: "1" }],
    }, mixed);
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.issues.some((item) => item.code === "invalid-operation")).toBe(true);
  });

  it("拒绝模型扩大用户已选择的记录范围或使用重复记录", () => {
    const invalid = validateAnalysisPlan({
      ...validPlan,
      recordIds: ["delivery-1", "delivery-1", "delivery-2"],
    }, delivery, { recordIds: ["delivery-1"] });
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.issues.some((item) => item.code === "invalid-record-range")).toBe(true);
  });

  it("独立校验模型声明的记录范围类型、存在性和重复项", () => {
    const invalid = validateAnalysisPlan({
      ...validPlan,
      recordIds: ["delivery-1", 42, "delivery-1"],
    }, delivery, { recordIds: ["delivery-1", "delivery-2"] });
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.issues.filter((item) => item.code === "invalid-record-range").length).toBeGreaterThanOrEqual(2);
  });

  it("拒绝缺少字段或额外字段的非协议计划", () => {
    const invalid = validateAnalysisPlan({ ...validPlan, extra: true }, delivery);
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.issues.some((item) => item.code === "unknown-property")).toBe(true);
  });
});

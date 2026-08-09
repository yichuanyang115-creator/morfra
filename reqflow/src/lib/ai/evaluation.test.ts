import { describe, expect, it } from "vitest";
import { createEvaluationTableAdapter } from "../../fixtures/aiEvaluationTables";
import { AI_EVALUATION_CASES, evaluateAICases, evaluateAIAdapter } from "./evaluation";

describe("AI 固定质量评估集", () => {
  it("覆盖空表、混合字段、空值、同名记录、跨表隔离、范围、路由和非法计划", () => {
    const report = evaluateAICases();
    expect(report.total).toBeGreaterThanOrEqual(15);
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(report.total);
    expect(AI_EVALUATION_CASES.some((testCase) => testCase.id === "empty-table-count")).toBe(true);
    expect(AI_EVALUATION_CASES.some((testCase) => testCase.id === "same-name-table-a")).toBe(true);
    expect(AI_EVALUATION_CASES.some((testCase) => testCase.id === "same-name-table-b")).toBe(true);
    expect(AI_EVALUATION_CASES.map((testCase) => testCase.id)).toEqual(expect.arrayContaining([
      "date-filter-normalizes-input",
      "invalid-filter-operation",
      "invalid-computed-operation",
      "cross-table-isolation",
      "natural-table-question-reads-table",
      "delivery-filter-not-equals",
      "delivery-filter-is-not-empty",
      "delivery-filter-greater-than-or-equal",
      "delivery-filter-less-than",
      "delivery-filter-less-than-or-equal",
      "mixed-text-contains",
      "mixed-multiselect-contains",
      "mixed-checkbox-equals",
      "mixed-computed-not-equals",
      "mixed-attachment-is-empty",
    ]));
  });

  it("通过只读适配器再次验证评估表隔离", async () => {
    const { adapter } = createEvaluationTableAdapter();
    const report = await evaluateAIAdapter(adapter);
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(report.total);
  });
});

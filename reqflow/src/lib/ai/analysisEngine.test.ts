import { describe, expect, it } from "vitest";
import { AI_EVALUATION_TABLES } from "../../fixtures/aiEvaluationTables";
import { executeAnalysisPlan } from "./analysisEngine";
import { normalizeTableSnapshot } from "./tableSnapshot";

const delivery = AI_EVALUATION_TABLES[0];
const basePlan = {
  filters: [],
  projections: [],
  groupBy: [],
  aggregates: [],
  sort: [],
  limit: null,
};

describe("本地确定性分析引擎", () => {
  it("在本地完成筛选、计数、求和、平均值、最值和排序", () => {
    const result = executeAnalysisPlan(delivery, {
      ...basePlan,
      filters: [{ fieldId: "status", operator: "isNotEmpty" }],
      projections: ["title", "effort"],
      sort: [{ fieldId: "effort", direction: "descending" }],
      limit: 2,
      aggregates: [
        { id: "count", operation: "count" },
        { id: "sum", operation: "sum", fieldId: "effort" },
        { id: "average", operation: "average", fieldId: "effort" },
        { id: "minimum", operation: "minimum", fieldId: "effort" },
        { id: "maximum", operation: "maximum", fieldId: "effort" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.filteredCount).toBe(3);
    expect(result.result.rows.map((row) => row.recordId)).toEqual(["delivery-3", "delivery-2"]);
    expect(result.result.aggregates.map((aggregate) => aggregate.value)).toEqual([3, 16, 16 / 3, 3, 8]);
    expect(result.result.aggregates.every((aggregate) => aggregate.status === "computed")).toBe(true);
  });

  it("支持分组、空值判断、多选项包含和选中记录范围", () => {
    const withoutGroup = executeAnalysisPlan(delivery, { ...basePlan });
    expect(withoutGroup.ok).toBe(true);
    if (withoutGroup.ok) expect(withoutGroup.result.groups).toEqual([]);

    const grouped = executeAnalysisPlan(delivery, { ...basePlan, groupBy: ["status"] });
    expect(grouped.ok).toBe(true);
    if (grouped.ok) expect(grouped.result.groups.map((group) => group.count)).toEqual([1, 1, 1]);

    const mixed = AI_EVALUATION_TABLES.find((table) => table.tableId === "table-mixed");
    if (!mixed) throw new Error("缺少混合字段评估表");
    const emptyProgress = executeAnalysisPlan(mixed, {
      ...basePlan,
      filters: [{ fieldId: "progress", operator: "isEmpty" }],
      aggregates: [{ id: "count", operation: "count" }],
    }, { recordIds: ["mixed-1", "mixed-2"] });
    expect(emptyProgress.ok).toBe(true);
    if (emptyProgress.ok) expect(emptyProgress.result.matchingRecordIds).toEqual(["mixed-1"]);

    const budget = AI_EVALUATION_TABLES.find((table) => table.tableId === "table-budget");
    if (!budget) throw new Error("缺少预算评估表");
    const category = executeAnalysisPlan(budget, {
      ...basePlan,
      filters: [{ fieldId: "category", operator: "contains", value: "software" }],
    });
    expect(category.ok).toBe(true);
    if (category.ok) expect(category.result.matchingRecordIds).toEqual(["budget-2"]);

    const percentage = executeAnalysisPlan(delivery, {
      ...basePlan,
      filters: [{ fieldId: "status", operator: "equals", value: "done" }],
      aggregates: [{ id: "percentage", operation: "percentage" }],
    });
    expect(percentage.ok).toBe(true);
    if (percentage.ok) expect(percentage.result.aggregates[0]?.value).toBeCloseTo(100 / 3);

    const insufficient = executeAnalysisPlan(mixed, {
      ...basePlan,
      filters: [{ fieldId: "amount", operator: "greaterThan", value: 100 }],
      aggregates: [{ id: "average", operation: "average", fieldId: "amount" }],
    });
    expect(insufficient.ok).toBe(true);
    if (insufficient.ok) expect(insufficient.result.aggregates[0]).toEqual(expect.objectContaining({ value: null, status: "insufficient-data" }));
  });

  it("无效计划直接失败，不产生任何统计结果", () => {
    const result = executeAnalysisPlan(delivery, { ...basePlan, aggregates: [{ id: "bad", operation: "sum", fieldId: "title" }] });
    expect(result).toEqual(expect.objectContaining({ ok: false, code: "invalid-analysis-plan" }));
  });

  it("按日期语义比较计划值，不受非 ISO 输入格式影响", () => {
    const mixedRaw = AI_EVALUATION_TABLES.find((table) => table.tableId === "table-mixed");
    if (!mixedRaw) throw new Error("缺少混合字段评估表");
    const rawResult = executeAnalysisPlan(mixedRaw, {
      ...basePlan,
      filters: [{ fieldId: "dueDate", operator: "equals", value: "2026/08/09" }],
    });
    expect(rawResult.ok).toBe(true);
    if (rawResult.ok) expect(rawResult.result.matchingRecordIds).toEqual(["mixed-2"]);

    const snapshot = normalizeTableSnapshot({
      tableId: "date-test",
      name: "日期测试",
      schemaVersion: "1",
      primaryTitleFieldId: "title",
      fields: [{ id: "title", name: "标题", type: "text" }, { id: "dueDate", name: "日期", type: "date" }],
      records: [
        { id: "r1", values: { title: "一", dueDate: "2026-08-10T00:00:00.000Z" } },
        { id: "r2", values: { title: "二", dueDate: "2026-08-11" } },
      ],
      capturedAt: "2026-08-08T08:00:00.000Z",
    });
    const result = executeAnalysisPlan(snapshot, {
      ...basePlan,
      filters: [{ fieldId: "dueDate", operator: "greaterThanOrEqual", value: "2026/08/10" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.result.matchingRecordIds).toEqual(["r1", "r2"]);
  });
});

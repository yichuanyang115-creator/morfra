import { describe, expect, it } from "vitest";
import { AI_EVALUATION_TABLES } from "../../fixtures/aiEvaluationTables";
import { prepareAnalysisContext, prepareAnalysisContextWithRetries } from "./contextBuilder";

const delivery = AI_EVALUATION_TABLES[0];
const basePlan = { filters: [], projections: ["title"], groupBy: [], aggregates: [{ id: "count", operation: "count" }], sort: [], limit: 10 };

describe("计划到最小回答上下文", () => {
  it("只发送所需字段、相关记录和本地计算结果，不携带整张表或其他表", () => {
    const prepared = prepareAnalysisContext(delivery, basePlan);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.context.source).toBe("local-analysis");
    expect(prepared.context.table.tableId).toBe("table-delivery");
    expect(prepared.context.fields.map((field) => field.id)).toEqual(["title"]);
    expect(prepared.context.records.map((record) => record.recordId)).toEqual(["delivery-1", "delivery-2", "delivery-3"]);
    expect(prepared.context.records.every((record) => Object.keys(record.values).every((id) => id === "title"))).toBe(true);
    expect(JSON.stringify(prepared.context)).not.toContain("budget-1");
  });

  it("选中范围只影响当前本地计划，非法计划不生成回答上下文", () => {
    const selected = prepareAnalysisContext(delivery, basePlan, { recordIds: ["delivery-2"] });
    expect(selected.ok).toBe(true);
    if (selected.ok) expect(selected.context.scope).toEqual({ type: "selectedRecords", recordIds: ["delivery-2"] });

    const invalid = prepareAnalysisContext(delivery, { ...basePlan, projections: ["missing"] });
    expect(invalid).toEqual(expect.objectContaining({ ok: false, code: "invalid-analysis-plan" }));
  });

  it("删除部分已选记录时剔除失效 ID，全失效时仍拒绝", () => {
    const partial = prepareAnalysisContext(delivery, basePlan, { recordIds: ["delivery-2", "deleted-record"] });
    expect(partial.ok).toBe(true);
    if (partial.ok) expect(partial.context.scope.recordIds).toEqual(["delivery-2"]);

    const allInvalid = prepareAnalysisContext(delivery, basePlan, { recordIds: ["deleted-record"] });
    expect(allInvalid).toEqual(expect.objectContaining({ ok: false, code: "invalid-analysis-plan" }));
  });

  it("maxContextRecords 同时限制记录行、分组引用和聚合引用", () => {
    const limited = prepareAnalysisContext(delivery, basePlan, { maxContextRecords: 1 });
    expect(limited.ok).toBe(true);
    if (limited.ok) {
      expect(limited.context.records).toHaveLength(1);
      expect(limited.context.analysis.rows).toHaveLength(1);
      expect(limited.context.records[0]?.recordId).toBe(limited.context.analysis.rows[0]?.recordId);
      expect(limited.context.analysis.matchingRecordIds).toEqual([limited.context.records[0]?.recordId]);
      expect(limited.context.analysis.aggregates.every((aggregate) => aggregate.contributingRecordIds.length <= 1)).toBe(true);
    }
  });

  it("有限重试后返回模型不兼容，不能用非法计划兜底生成精确结果", () => {
    const result = prepareAnalysisContextWithRetries(delivery, [
      { ...basePlan, projections: ["missing"] },
      { ...basePlan, aggregates: [{ id: "bad", operation: "sum", fieldId: "title" }] },
    ]);
    expect(result).toEqual(expect.objectContaining({ ok: false, code: "model-incompatible" }));
  });
});

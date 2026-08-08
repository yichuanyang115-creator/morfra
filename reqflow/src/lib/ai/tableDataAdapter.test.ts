import { describe, expect, it, vi } from "vitest";
import { AI_EVALUATION_TABLES, createEvaluationTableAdapter } from "../../fixtures/aiEvaluationTables";

describe("TableDataAdapter 固定双表实现", () => {
  it("仅通过只读端口取得两张相互隔离的完整表快照", async () => {
    const { adapter } = createEvaluationTableAdapter();

    const delivery = await adapter.getTableSnapshot("table-delivery");
    const budget = await adapter.getTableSnapshot("table-budget");

    expect(delivery.tableId).toBe("table-delivery");
    expect(delivery.records).toHaveLength(3);
    expect(budget.tableId).toBe("table-budget");
    expect(budget.records).toHaveLength(2);
    expect(delivery.records.map((record) => record.id)).not.toEqual(budget.records.map((record) => record.id));
  });

  it("返回快照副本，调用方修改不会污染固定数据或另一张表", async () => {
    const { adapter } = createEvaluationTableAdapter();
    const first = await adapter.getTableSnapshot("table-delivery");
    first.records[0].values.title = "被调用方修改";

    const reloaded = await adapter.getTableSnapshot("table-delivery");
    const other = await adapter.getTableSnapshot("table-budget");

    expect(reloaded.records[0].values.title).toBe("领域契约");
    expect(other.records[0].values.item).toBe("模型服务");
    expect(AI_EVALUATION_TABLES[0].records[0].values.title).toBe("领域契约");
  });

  it("活动表、选择与事件均按 tableId 工作，退订后不再通知", () => {
    const controls = createEvaluationTableAdapter();
    const listener = vi.fn();
    const unsubscribe = controls.adapter.subscribe(listener);

    controls.setActiveTable("table-budget");
    controls.setSelectedRecordIds("table-budget", ["budget-1", "missing"]);

    expect(controls.adapter.getActiveTable()).toEqual({ tableId: "table-budget", name: "预算跟踪" });
    expect(controls.adapter.getSelectedRecordIds("table-budget")).toEqual(["budget-1"]);
    expect(controls.adapter.getSelectedRecordIds("table-delivery")).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    controls.setActiveTable(null);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

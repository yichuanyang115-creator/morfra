import { describe, expect, it } from "vitest";
import { AI_EVALUATION_TABLES } from "../../fixtures/aiEvaluationTables";
import {
  getRecordTitle,
  normalizeTableSnapshot,
  TableSnapshotValidationError,
} from "./tableSnapshot";

describe("TableSnapshot 规范化", () => {
  it("保留稳定表 ID、字段 Schema、recordId 与按字段类型规范化的值", () => {
    const snapshot = normalizeTableSnapshot(AI_EVALUATION_TABLES.find((table) => table.tableId === "table-mixed"));
    expect(snapshot.tableId).toBe("table-mixed");
    expect(snapshot.primaryTitleFieldId).toBe("title");
    expect(snapshot.records.map((record) => record.id)).toEqual(["mixed-1", "mixed-2"]);
    expect(snapshot.records[0]?.values.progress).toBeNull();
    expect(snapshot.records[1]?.values.progress).toBe(50);
    expect(snapshot.records[0]?.values.tags).toEqual(["alpha"]);
  });

  it("主标题使用主标题字段，空值记录使用稳定回退文案", () => {
    const snapshot = normalizeTableSnapshot({
      tableId: "title-test",
      name: "标题测试",
      schemaVersion: "1",
      primaryTitleFieldId: "title",
      fields: [{ id: "title", name: "标题", type: "text" }],
      records: [{ id: "record-1", values: { title: "" } }],
      capturedAt: "2026-08-08T08:00:00.000Z",
    });
    expect(getRecordTitle(snapshot, "record-1")).toBe("未命名记录");
  });

  it.each([
    ["records[0].values.missing", { values: { title: "标题", missing: 1 } }],
    ["records[0].values.progress", { values: { title: "标题", progress: 101 } }],
  ])("拒绝无效快照：%s", (path, record) => {
    expect(() => normalizeTableSnapshot({
      tableId: "invalid",
      name: "无效",
      schemaVersion: "1",
      primaryTitleFieldId: "title",
      fields: [
        { id: "title", name: "标题", type: "text" },
        { id: "progress", name: "进度", type: "percent" },
      ],
      records: [{ id: "record-1", ...record }],
      capturedAt: "2026-08-08T08:00:00.000Z",
    })).toThrow(TableSnapshotValidationError);
    expect(path).toContain("records[0]");
  });
});

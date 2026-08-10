import { describe, expect, it } from "vitest";
import { previewFieldConversion } from "./valueConversion";
import type { TableDataSnapshot } from "../../types/domain";

const snapshot: TableDataSnapshot = {
  tableId: "table-1",
  groups: [],
  fields: [{ id: "field-1", tableId: "table-1", groupId: null, name: "分数", fieldType: "text", isTitle: false, position: 1, config: {}, options: [] }],
  records: [
    { id: "record-1", tableId: "table-1", position: 0, autoNumber: 1, createdAt: "1", updatedAt: "1", values: { "field-1": "42" }, multiSelectValues: {} },
    { id: "record-2", tableId: "table-1", position: 1, autoNumber: 2, createdAt: "1", updatedAt: "1", values: { "field-1": "不是数字" }, multiSelectValues: {} },
  ],
};

describe("previewFieldConversion", () => {
  it("reports lossy numeric conversion instead of hiding invalid values", () => {
    expect(previewFieldConversion(snapshot, "field-1", "number")).toMatchObject({ recordCount: 2, convertedCount: 1, clearedCount: 1 });
  });

  it("deduplicates text values when generating select options", () => {
    const data = { ...snapshot, records: snapshot.records.map((record) => ({ ...record, values: { "field-1": "同一选项" } })) };
    expect(previewFieldConversion(data, "field-1", "select").generatedOptions).toEqual(["同一选项"]);
  });

  it("also previews generated options when converting numeric values", () => {
    const data = { ...snapshot, fields: [{ ...snapshot.fields[0], fieldType: "number" as const }], records: [{ ...snapshot.records[0], values: { "field-1": 42 } }] };
    expect(previewFieldConversion(data, "field-1", "select").generatedOptions).toEqual(["42"]);
  });
});

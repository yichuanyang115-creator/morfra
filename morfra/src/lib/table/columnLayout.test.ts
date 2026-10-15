import { describe, expect, it } from "vitest";
import type { FieldSummary } from "../../types/domain";
import { buildColumnLayouts, clampColumnWidth, defaultColumnWidth, MIN_SCROLLABLE_WIDTH, ROW_NUMBER_WIDTH } from "./columnLayout";

function field(id: string, isTitle = false): FieldSummary {
  return { id, tableId: "table-1", groupId: null, name: id, fieldType: "text", isTitle, position: 0, config: {}, options: [] };
}

describe("columnLayout", () => {
  it("按字段语义提供默认宽度，并保护主标题最低 180px", () => {
    expect(defaultColumnWidth(field("title", true))).toBe(240);
    expect(defaultColumnWidth({ ...field("number"), fieldType: "number" })).toBe(120);
    expect(clampColumnWidth(field("title", true), 20)).toBe(180);
    expect(clampColumnWidth(field("text"), 900)).toBe(600);
  });

  it("空间不足时从最右侧临时取消额外冻结，主标题仍保持冻结", () => {
    const layouts = buildColumnLayouts([field("title", true), field("first"), field("second")], {}, "second", ROW_NUMBER_WIDTH + 240 + MIN_SCROLLABLE_WIDTH + 10);
    expect(layouts.map((item) => item.frozen)).toEqual([true, false, false]);
  });

  it("空间足够时保留连续冻结区", () => {
    const layouts = buildColumnLayouts([field("title", true), field("first"), field("second")], {}, "second", 1400);
    expect(layouts.map((item) => item.frozen)).toEqual([true, true, true]);
  });

  it("窄画布临时把主标题压到 180px，始终留出 280px 滚动区", () => {
    const layouts = buildColumnLayouts([field("title", true), field("first")], {}, "first", ROW_NUMBER_WIDTH + 180 + MIN_SCROLLABLE_WIDTH);
    expect(layouts[0]?.width).toBe(180);
    expect(layouts.filter((item) => item.frozen)).toHaveLength(1);
  });
});

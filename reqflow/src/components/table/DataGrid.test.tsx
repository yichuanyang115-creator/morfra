import { describe, expect, it } from "vitest";
import type { FieldSummary } from "../../types/domain";
import { normalizeGridFieldIds, parseGridLayout } from "./DataGrid";

const fields: FieldSummary[] = [
  { id: "title", tableId: "table-1", groupId: null, name: "名称", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "status", tableId: "table-1", groupId: "group-1", name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [] },
];

describe("parseGridLayout", () => {
  it("为空视图配置补齐 v3 表格布局默认值", () => {
    expect(parseGridLayout({}, fields)).toEqual({ fieldIds: ["title", "status"], groupOrder: ["group-1"], columnWidths: {}, frozenFieldId: null, rowHeight: 40, collapsedGroupIds: [] });
  });

  it("空 fieldIds 与缺失配置同义，显式仅主标题不触发默认回退", () => {
    expect(parseGridLayout({ fieldIds: [] }, fields).fieldIds).toEqual(["title", "status"]);
    expect(parseGridLayout({ fieldIds: ["title"] }, fields).fieldIds).toEqual(["title"]);
  });

  it("恢复旧缓存时补回主标题、过滤失效项并去重，供画布与面板共用", () => {
    expect(normalizeGridFieldIds(["status", "unknown", "status"], fields)).toEqual(["title", "status"]);
    expect(parseGridLayout({ fieldIds: ["status", "unknown", "status"] }, fields).fieldIds).toEqual(["title", "status"]);
  });

  it("仅接受可辨识的行高和数值列宽，防止旧配置损坏画布", () => {
    expect(parseGridLayout({ fieldIds: ["title"], rowHeight: 999, columnWidths: { title: 280, bad: "x" }, frozenFieldId: "title", collapsedGroupIds: ["group-1", 1] }, fields)).toEqual({ fieldIds: ["title"], groupOrder: ["group-1"], columnWidths: { title: 280 }, frozenFieldId: "title", rowHeight: 40, collapsedGroupIds: ["group-1"] });
  });
});

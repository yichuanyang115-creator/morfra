import { describe, expect, it } from "vitest";
import type { FieldSummary } from "../../types/domain";
import { nextGridScrollTop, normalizeGridFieldIds, orderGridFieldIdsByGroup, parseGridLayout } from "./DataGrid";

const fields: FieldSummary[] = [
  { id: "title", tableId: "table-1", groupId: null, name: "名称", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "status", tableId: "table-1", groupId: "group-1", name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [] },
];

describe("parseGridLayout", () => {
  it("纵向自动滚动为 64px 粘性表头保留可见空间", () => {
    expect(nextGridScrollTop(264, 304, 0, 160)).toBe(144);
    expect(nextGridScrollTop(104, 144, 200, 160)).toBe(40);
    expect(nextGridScrollTop(144, 184, 80, 160)).toBe(80);
  });

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

  it("以 groupOrder 作为画布恢复时的分组排序真相源", () => {
    const groupedFields: FieldSummary[] = [
      fields[0],
      { ...fields[1], groupId: "group-a" },
      { id: "owner", tableId: "table-1", groupId: "group-b", name: "负责人", fieldType: "text", isTitle: false, position: 2, config: {}, options: [] },
    ];
    const groupOrder = ["group-b", "group-a", "ungrouped"];

    expect(orderGridFieldIdsByGroup(["title", "status", "owner"], groupedFields, groupOrder)).toEqual(["title", "owner", "status"]);
    expect(parseGridLayout({ fieldIds: ["title", "status", "owner"], groupOrder }, groupedFields, [
      { id: "group-a", tableId: "table-1", name: "阶段", position: 0 },
      { id: "group-b", tableId: "table-1", name: "负责人", position: 1 },
    ]).fieldIds).toEqual(["title", "owner", "status"]);
  });
});

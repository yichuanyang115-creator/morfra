import { describe, expect, it } from "vitest";
import type { FieldSummary, RecordData } from "../../types/domain";
import { groupMoveValue, moveRecordBefore, nextGridScrollTop, normalizeGridFieldIds, normalizeGridValue, orderGridFieldIdsByGroup, parseGridLayout } from "./DataGrid";

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

  it("跨组写入保持多选其他选项，拖入未分组时清空", () => {
    const tags: FieldSummary = { ...fields[1], id: "tags", fieldType: "multi_select" };
    const record: RecordData = { id: "record", tableId: "table-1", position: 0, autoNumber: 1, createdAt: "", updatedAt: "", values: {}, multiSelectValues: { tags: ["bug", "hot", "keep"] } };
    expect(groupMoveValue(record, tags, "bug", "done")).toEqual(["hot", "keep", "done"]);
    expect(groupMoveValue(record, tags, "bug", "__empty__")).toEqual([]);
  });

  it("把底层记录移动到同组目标记录之前", () => {
    expect(moveRecordBefore(["one", "two", "three"], "three", "two")).toEqual(["one", "three", "two"]);
  });

  it("将图片和文件编辑草稿规范化为多附件 URL 列表", () => {
    const file: FieldSummary = { ...fields[1], id: "files", fieldType: "file" };
    expect(normalizeGridValue(file, "https://a.test/one.pdf, https://a.test/two.pdf")).toEqual(["https://a.test/one.pdf", "https://a.test/two.pdf"]);
  });
});

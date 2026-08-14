import { describe, expect, it } from "vitest";
import type { FieldSummary } from "../../types/domain";
import { nextGridScrollTop, normalizeGridFieldIds, normalizeGridValue, parseGridLayout } from "./DataGrid";

const fields: FieldSummary[] = [
  { id: "title", tableId: "table-1", groupId: null, name: "名称", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "status", tableId: "table-1", groupId: "group-1", name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [] },
];

describe("parseGridLayout", () => {
  it("纵向自动滚动为单层 40px 粘性表头保留可见空间", () => {
    expect(nextGridScrollTop(264, 304, 0, 160)).toBe(144);
    expect(nextGridScrollTop(104, 144, 200, 160)).toBe(64);
    expect(nextGridScrollTop(144, 184, 80, 160)).toBe(80);
  });

  it("为空视图配置补齐 v3 表格布局默认值", () => {
    expect(parseGridLayout({}, fields)).toEqual({ fieldIds: ["title", "status"], columnWidths: {}, frozenFieldId: null, rowHeight: 40 });
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
    expect(parseGridLayout({ fieldIds: ["title"], rowHeight: 999, columnWidths: { title: 280, bad: "x" }, frozenFieldId: "title" }, fields)).toEqual({ fieldIds: ["title"], columnWidths: { title: 280 }, frozenFieldId: "title", rowHeight: 40 });
  });

  it("保留当前视图的普通字段横向顺序", () => expect(parseGridLayout({ fieldIds: ["title", "status"] }, fields).fieldIds).toEqual(["title", "status"]));

  it("恢复旧视图时清理图片、文件和链接等无效排序引用", () => {
    const file = { ...fields[1], id: "files", fieldType: "file" as const };
    const layout = parseGridLayout({ sorts: [{ id: "file-sort", fieldId: "files", direction: "asc" }, { id: "title-sort", fieldId: "title", direction: "desc" }] }, [...fields, file]);
    expect(layout.pipeline?.sorts).toEqual([{ id: "title-sort", fieldId: "title", direction: "desc" }]);
  });

  it("恢复旧视图时清理不再允许的分组字段和折叠状态", () => {
    const file = { ...fields[1], id: "files", fieldType: "file" as const };
    const layout = parseGridLayout({ group: { fieldId: "files", direction: "desc", collapsedKeys: ["x"] } }, [...fields, file]);
    expect(layout.pipeline?.group).toEqual({ fieldId: null, direction: "asc", collapsedKeys: [] });
  });

  it("将图片和文件编辑草稿规范化为多附件 URL 列表", () => {
    const file: FieldSummary = { ...fields[1], id: "files", fieldType: "file" };
    expect(normalizeGridValue(file, "https://a.test/one.pdf, https://a.test/two.pdf")).toEqual(["https://a.test/one.pdf", "https://a.test/two.pdf"]);
  });
});

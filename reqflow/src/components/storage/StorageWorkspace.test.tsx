import { describe, expect, it } from "vitest";
import type { FieldSummary } from "../../types/domain";
import { parseCachedGridLayout } from "./StorageWorkspace";

const fields: FieldSummary[] = [
  { id: "title", tableId: "table-1", groupId: null, name: "名称", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "status", tableId: "table-1", groupId: null, name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [] },
];

describe("parseCachedGridLayout", () => {
  it("配置读取失败后从旧缓存恢复时，画布仍保留主标题", () => {
    expect(parseCachedGridLayout('["status"]', fields).fieldIds).toEqual(["title", "status"]);
  });

  it("空或损坏的本地缓存恢复为默认全字段布局", () => {
    expect(parseCachedGridLayout("[]", fields).fieldIds).toEqual(["title", "status"]);
    expect(parseCachedGridLayout("not-json", fields).fieldIds).toEqual(["title", "status"]);
  });

  it("新格式缓存保留完整字段布局配置", () => {
    expect(parseCachedGridLayout('{"fieldIds":["status"],"groupOrder":["group-1"]}', fields, [{ id: "group-1", tableId: "table-1", name: "阶段", position: 0 }])).toMatchObject({ fieldIds: ["title", "status"], groupOrder: ["group-1", "ungrouped"] });
  });
});

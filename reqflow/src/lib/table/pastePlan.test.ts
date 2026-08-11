import { describe, expect, it } from "vitest";
import type { TableDataSnapshot } from "../../types/domain";
import { singleCell } from "./selectionModel";
import { buildClearPlan, buildPastePlan, externalPastePlan } from "./pastePlan";

const data: TableDataSnapshot = {
  tableId: "table-1",
  groups: [],
  fields: [
    { id: "title", tableId: "table-1", groupId: null, name: "名称", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
    { id: "description", tableId: "table-1", groupId: null, name: "说明", fieldType: "text", isTitle: false, position: 1, config: {}, options: [] },
    { id: "progress", tableId: "table-1", groupId: null, name: "进度", fieldType: "progress", isTitle: false, position: 2, config: {}, options: [] },
    { id: "tag", tableId: "table-1", groupId: null, name: "标签", fieldType: "select", isTitle: false, position: 3, config: {}, options: [{ id: "p0", fieldId: "tag", name: "P0", color: "red", position: 0 }] },
    { id: "created", tableId: "table-1", groupId: null, name: "创建时间", fieldType: "created_time", isTitle: false, position: 4, config: {}, options: [] },
  ],
  records: [{ id: "record-1", tableId: "table-1", position: 0, autoNumber: 1, createdAt: "", updatedAt: "", values: { title: "旧标题", description: "", progress: 20, tag: "p0", created: "2026-08-01" }, multiSelectValues: {} }],
};

describe("buildPastePlan", () => {
  it("全量转换有效 TSV 后生成一个原子更新计划", () => {
    const plan = externalPastePlan(data, data.fields, singleCell({ row: 0, column: 0 }), "新标题\t补充说明\t25\tP0");
    expect(plan).not.toBeInstanceOf(Error);
    expect(plan).toMatchObject({ updates: [{ recordId: "record-1", fieldId: "title", value: "新标题" }, { fieldId: "description", value: "补充说明" }, { fieldId: "progress", value: 25 }, { fieldId: "tag", value: "p0" }] });
  });

  it("存在只读字段或非法值时拒绝整次粘贴", () => {
    const readonly = externalPastePlan(data, data.fields, singleCell({ row: 0, column: 4 }), "2026-09-01");
    const invalid = externalPastePlan(data, data.fields, singleCell({ row: 0, column: 2 }), "101");
    expect(readonly).toBeInstanceOf(Error);
    expect(invalid).toBeInstanceOf(Error);
  });

  it("内部单值会填满矩形选区", () => {
    const selection = { active: { row: 0, column: 0 }, range: { anchor: { row: 0, column: 0 }, focus: { row: 0, column: 1 } }, rows: [] };
    const plan = buildPastePlan(data, data.fields, selection, [["重写"]]);
    expect(plan).toMatchObject({ updates: [{ fieldId: "title", value: "重写" }, { fieldId: "description", value: "重写" }] });
  });

  it("内部类型剪贴板也会在提交前拒绝未知选项", () => {
    const plan = buildPastePlan(data, data.fields, singleCell({ row: 0, column: 3 }), { version: 1, fieldIds: ["tag"], values: [["missing"]] });
    expect(plan).toBeInstanceOf(Error);
  });

  it("Delete 会清空包括主标题在内的所有可编辑单元格", () => {
    const plan = buildClearPlan(data, data.fields, singleCell({ row: 0, column: 0 }));
    expect(plan).toMatchObject({ updates: [{ recordId: "record-1", fieldId: "title", value: null }] });
  });
});

import { describe, expect, it } from "vitest";
import { STAGES, RELEASE_METHODS } from "../types/models";
import { legacyEquivalentSchema, blankSchema, reqflowTemplateSnapshot, schemaFromSnapshot, schemaSnapshot } from "./schemaDefaults";

describe("legacyEquivalentSchema", () => {
  it("阶段选项与 STAGES 常量一一对应，只有归档标终态", () => {
    const schema = legacyEquivalentSchema([]);
    expect(schema.stageOptions.map((s) => s.id)).toEqual(STAGES.map((s) => s.key));
    expect(schema.stageOptions.map((s) => s.label)).toEqual(STAGES.map((s) => s.label));
    expect(schema.stageOptions.filter((s) => s.isTerminal).map((s) => s.id)).toEqual(["archive"]);
  });

  it("阶段颜色两两不重复（8 色色板轮询，7 个阶段不会撞色）", () => {
    const schema = legacyEquivalentSchema([]);
    const colors = schema.stageOptions.map((s) => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("来源属性的选项来自传入的 sources 快照", () => {
    const schema = legacyEquivalentSchema(["用户反馈", "内部想法"]);
    const source = schema.attributes.find((a) => a.id === "source");
    expect(source?.options?.map((o) => o.label)).toEqual(["用户反馈", "内部想法"]);
  });

  it("发布方式属性的选项与 RELEASE_METHODS 常量等价", () => {
    const schema = legacyEquivalentSchema([]);
    const releaseMethod = schema.attributes.find((a) => a.id === "release_method");
    expect(releaseMethod?.options?.map((o) => o.label)).toEqual(RELEASE_METHODS);
  });

  it("结果属性提供完成/废弃两个选项（承接 closureType 迁移）", () => {
    const schema = legacyEquivalentSchema([]);
    const result = schema.attributes.find((a) => a.id === "result");
    expect(result?.options?.map((o) => o.id)).toEqual(["completed", "abandoned"]);
  });

  it("创建时间作为计算属性存在，看板/详情页均可见（旧硬编码看板列不因 Schema 化而消失）", () => {
    const schema = legacyEquivalentSchema([]);
    const createdAt = schema.attributes.find((a) => a.id === "created_at");
    expect(createdAt?.type).toBe("computed");
    expect(createdAt?.computedKind).toBe("createdAt");
    expect(createdAt?.showOnBoard).toBe(true);
    expect(createdAt?.showOnDetail).toBe(true);
  });

  it("预制 Tab 包含正文/产出/任务/验收/活动，全部可见", () => {
    const schema = legacyEquivalentSchema([]);
    expect(schema.tabs.map((t) => t.renderer)).toEqual(["body", "deliverables", "tasks", "acceptance", "activity"]);
    expect(schema.tabs.every((t) => t.visible)).toBe(true);
  });
});

describe("blankSchema", () => {
  it("只有一个默认阶段选项，无属性无 Tab", () => {
    const schema = blankSchema();
    expect(schema.stageOptions).toHaveLength(1);
    expect(schema.attributes).toHaveLength(0);
    expect(schema.tabs).toHaveLength(0);
  });
});

describe("Schema 模板快照", () => {
  it("快照移除 viewPreferences，新项目由同一快照创建时获得干净视图偏好", () => {
    const schema = legacyEquivalentSchema([]);
    schema.viewPreferences.columnWidths.priority = 280;
    const snapshot = schemaSnapshot(schema);
    const created = schemaFromSnapshot(snapshot);

    expect(snapshot).not.toHaveProperty("viewPreferences");
    expect(created.viewPreferences.columnWidths).toEqual({});
    expect(created.stageOptions).toEqual(schema.stageOptions);
  });

  it("reqflow 内置模板包含完整的 7 阶段和预制 Tab", () => {
    const snapshot = reqflowTemplateSnapshot();
    expect(snapshot.stageOptions).toHaveLength(7);
    expect(snapshot.tabs).toHaveLength(5);
  });
});

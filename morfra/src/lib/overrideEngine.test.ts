import { describe, expect, it } from "vitest";
import type { Attribute, AttributeOverride } from "../types/schema";
import { resolveStageOverrides } from "./overrideEngine";

function makeAttribute(id: string, name?: string): Attribute {
  return { id, name: name ?? id, type: "text", showOnBoard: true, showOnDetail: true };
}

function byId(attributes: Attribute[]): Map<string, Attribute> {
  return new Map(attributes.map((a) => [a.id, a]));
}

describe("resolveStageOverrides", () => {
  const columns = [makeAttribute("priority", "优先级"), makeAttribute("assignee", "负责人"), makeAttribute("deadline", "截止日期")];
  const all = [...columns, makeAttribute("releaseMethod", "发布方式"), makeAttribute("releaseDate", "发布时间")];

  it("没有覆盖规则时列位原样返回", () => {
    expect(resolveStageOverrides(columns, byId(all), undefined)).toEqual(columns);
    expect(resolveStageOverrides(columns, byId(all), [])).toEqual(columns);
  });

  it("覆盖命中的列位被替换为 to 属性，未命中的保持原样，顺序不变", () => {
    const overrides: AttributeOverride[] = [
      { fromAttributeId: "priority", toAttributeId: "releaseMethod" },
      { fromAttributeId: "deadline", toAttributeId: "releaseDate" },
    ];
    const resolved = resolveStageOverrides(columns, byId(all), overrides);
    expect(resolved.map((a) => a.id)).toEqual(["releaseMethod", "assignee", "releaseDate"]);
  });

  it("to 属性即使 showOnBoard 为 false（不在列位里），只要在全部属性索引中就能占位", () => {
    const hidden = makeAttribute("stayDays", "停留天数");
    hidden.showOnBoard = false;
    const allWithHidden = [...columns, hidden];
    const overrides: AttributeOverride[] = [{ fromAttributeId: "deadline", toAttributeId: "stayDays" }];
    const resolved = resolveStageOverrides(columns, byId(allWithHidden), overrides);
    expect(resolved[2].id).toBe("stayDays");
  });

  it("to 属性不在全部属性索引中时兜底保留原属性，不产生空列", () => {
    const overrides: AttributeOverride[] = [{ fromAttributeId: "priority", toAttributeId: "ghost" }];
    const resolved = resolveStageOverrides(columns, byId(all), overrides);
    expect(resolved[0].id).toBe("priority");
  });

  it("from 或 to 为空的覆盖条目被忽略", () => {
    const overrides: AttributeOverride[] = [
      { fromAttributeId: "", toAttributeId: "releaseMethod" },
      { fromAttributeId: "priority", toAttributeId: "" },
    ];
    expect(resolveStageOverrides(columns, byId(all), overrides)).toEqual(columns);
  });

  it("from 已从看板隐藏（不在列位里）的覆盖对看板无作用", () => {
    const overrides: AttributeOverride[] = [{ fromAttributeId: "source", toAttributeId: "releaseMethod" }];
    expect(resolveStageOverrides(columns, byId(all), overrides)).toEqual(columns);
  });
});

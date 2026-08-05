import { describe, expect, it } from "vitest";
import type { Attribute, AttributeDependency } from "../types/schema";
import { dependencySatisfied } from "./dependencyEngine";

function makeAttribute(dependsOn?: AttributeDependency): Attribute {
  return { id: "b", name: "B", type: "text", showOnBoard: true, showOnDetail: true, dependsOn };
}

describe("dependencySatisfied", () => {
  it("没有依赖条件时恒满足", () => {
    expect(dependencySatisfied(makeAttribute(undefined), {})).toBe(true);
  });

  it("单选依赖：依赖源取配置的 optionId 时满足，否则不满足", () => {
    const attr = makeAttribute({ attributeId: "priority", value: "P1" });
    expect(dependencySatisfied(attr, { priority: "P1" })).toBe(true);
    expect(dependencySatisfied(attr, { priority: "P2" })).toBe(false);
  });

  it("单选依赖：依赖源未设置时条件不满足（格子为空，不是忽略条件）", () => {
    const attr = makeAttribute({ attributeId: "priority", value: "P1" });
    expect(dependencySatisfied(attr, {})).toBe(false);
    expect(dependencySatisfied(attr, { priority: undefined })).toBe(false);
  });

  it("多选依赖：依赖源当前值数组包含配置的选项时满足，否则不满足", () => {
    const attr = makeAttribute({ attributeId: "tags", value: "frontend" });
    expect(dependencySatisfied(attr, { tags: ["frontend", "backend"] })).toBe(true);
    expect(dependencySatisfied(attr, { tags: ["backend"] })).toBe(false);
    expect(dependencySatisfied(attr, { tags: [] })).toBe(false);
  });

  it("文本依赖：字符串严格相等", () => {
    const attr = makeAttribute({ attributeId: "assignee", value: "张三" });
    expect(dependencySatisfied(attr, { assignee: "张三" })).toBe(true);
    expect(dependencySatisfied(attr, { assignee: "李四" })).toBe(false);
  });

  it("数字依赖：数值严格相等（配置侧存 number，不是字符串）", () => {
    const attr = makeAttribute({ attributeId: "progress", value: 100 });
    expect(dependencySatisfied(attr, { progress: 100 })).toBe(true);
    expect(dependencySatisfied(attr, { progress: 50 })).toBe(false);
    expect(dependencySatisfied(attr, { progress: "100" })).toBe(false);
  });

  it("勾选依赖：布尔严格相等", () => {
    const attr = makeAttribute({ attributeId: "flag", value: true });
    expect(dependencySatisfied(attr, { flag: true })).toBe(true);
    expect(dependencySatisfied(attr, { flag: false })).toBe(false);
  });
});

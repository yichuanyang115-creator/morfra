import { describe, expect, it } from "vitest";
import type { Attribute } from "../types/schema";
import type { Requirement } from "../types/models";
import { effectiveStageSort, reorderManualOrder, sortRequirementsForStage, sortableAttributes } from "./requirementSort";

const ATTRIBUTES: Attribute[] = [
  { id: "priority", name: "优先级", type: "number", showOnBoard: true, showOnDetail: true },
  { id: "owner", name: "负责人", type: "text", showOnBoard: true, showOnDetail: true },
  { id: "created_at", name: "创建时间", type: "computed", computedKind: "createdAt", showOnBoard: true, showOnDetail: true },
];

function makeRequirement(id: string, values: Record<string, unknown> = {}, overrides: Partial<Requirement> = {}): Requirement {
  return {
    id,
    name: id,
    stage: "design",
    createdAt: "2026-01-01T00:00:00.000Z",
    manualOrder: 0,
    body: "",
    attributeValues: values,
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

describe("sortableAttributes", () => {
  it("排除文本、勾选和附件属性", () => {
    expect(sortableAttributes(ATTRIBUTES).map((attribute) => attribute.id)).toEqual(["priority", "created_at"]);
  });
});

describe("effectiveStageSort", () => {
  it("局部规则覆盖全局规则", () => {
    expect(effectiveStageSort("design", { attrId: "created_at", direction: "desc" }, { design: { attrId: "priority", direction: "asc" } })).toEqual({
      mode: "rule",
      rule: { attrId: "priority", direction: "asc" },
    });
  });

  it("手动标记覆盖全局规则", () => {
    expect(effectiveStageSort("design", { attrId: "created_at", direction: "desc" }, { design: { mode: "manual" } })).toEqual({ mode: "manual", rule: null });
  });

  it("未配置全局规则时沿用创建时间降序默认规则", () => {
    expect(effectiveStageSort("design", null, {}, ATTRIBUTES)).toEqual({ mode: "rule", rule: { attrId: "created_at", direction: "desc" } });
  });
});

describe("sortRequirementsForStage", () => {
  it("按动态 Schema 属性排序", () => {
    const requirements = [makeRequirement("low", { priority: 2 }), makeRequirement("high", { priority: 0 })];
    const sorted = sortRequirementsForStage(requirements, { mode: "rule", rule: { attrId: "priority", direction: "asc" } }, ATTRIBUTES);
    expect(sorted.map((requirement) => requirement.id)).toEqual(["high", "low"]);
  });

  it("无规则时保持传入顺序", () => {
    const requirements = [makeRequirement("b"), makeRequirement("a")];
    expect(sortRequirementsForStage(requirements, { mode: "rule", rule: null }, ATTRIBUTES).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("空值在升序和降序下都排在有值项之后", () => {
    const requirements = [makeRequirement("empty", { priority: null }), makeRequirement("value", { priority: 1 })];
    const ascending = sortRequirementsForStage(requirements, { mode: "rule", rule: { attrId: "priority", direction: "asc" } }, ATTRIBUTES);
    const descending = sortRequirementsForStage(requirements, { mode: "rule", rule: { attrId: "priority", direction: "desc" } }, ATTRIBUTES);
    expect(ascending.map((requirement) => requirement.id)).toEqual(["value", "empty"]);
    expect(descending.map((requirement) => requirement.id)).toEqual(["value", "empty"]);
  });

  it("手动模式按 manualOrder 排序", () => {
    const requirements = [makeRequirement("a", {}, { manualOrder: 2 }), makeRequirement("b", {}, { manualOrder: 0 })];
    const sorted = sortRequirementsForStage(requirements, { mode: "manual", rule: null }, ATTRIBUTES);
    expect(sorted.map((requirement) => requirement.id)).toEqual(["b", "a"]);
  });
});

it("reorderManualOrder 只生成传入阶段的连续顺序", () => {
  expect(reorderManualOrder([makeRequirement("b"), makeRequirement("a")])).toEqual([
    { requirementId: "b", manualOrder: 0 },
    { requirementId: "a", manualOrder: 1 },
  ]);
});

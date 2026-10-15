import { describe, expect, it } from "vitest";
import type { Requirement } from "../types/models";
import type { Attribute } from "../types/schema";
import { countValuedAttribute, typeChangeImpact } from "./attributeImpact";

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: "r-1",
    name: "需求",
    stage: "collect",
    createdAt: "2026-01-01T00:00:00.000Z",
    manualOrder: 0,
    body: "",
    attributeValues: {},
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

describe("countValuedAttribute", () => {
  it("统计填了非空值的需求条数", () => {
    const requirements = [
      makeRequirement({ id: "r-1", attributeValues: { priority: "P0" } }),
      makeRequirement({ id: "r-2", attributeValues: { priority: "" } }),
      makeRequirement({ id: "r-3", attributeValues: { priority: null } }),
      makeRequirement({ id: "r-4", attributeValues: {} }),
      makeRequirement({ id: "r-5", attributeValues: { priority: "P2" } }),
    ];
    expect(countValuedAttribute(requirements, "priority")).toBe(2);
  });

  it("多选类型空数组不算填值", () => {
    const requirements = [
      makeRequirement({ attributeValues: { tags: [] } }),
      makeRequirement({ attributeValues: { tags: ["a"] } }),
    ];
    expect(countValuedAttribute(requirements, "tags")).toBe(1);
  });

  it("没有任何需求填值时返回 0", () => {
    expect(countValuedAttribute([], "priority")).toBe(0);
  });
});

describe("typeChangeImpact", () => {
  it("统计总条数和有损转换的条数", () => {
    const attribute: Attribute = {
      id: "priority",
      name: "优先级",
      type: "multiSelect",
      options: [{ id: "p0", label: "P0" }, { id: "p1", label: "P1" }],
      showOnBoard: true,
      showOnDetail: true,
    };
    const requirements = [
      makeRequirement({ id: "r-1", attributeValues: { priority: ["p0", "p1"] } }), // 多值→单选，有损
      makeRequirement({ id: "r-2", attributeValues: { priority: ["p0"] } }), // 单值→单选，无损
      makeRequirement({ id: "r-3", attributeValues: { priority: [] } }), // 空值，无损
    ];

    const impact = typeChangeImpact(requirements, attribute, "singleSelect");
    expect(impact.totalCount).toBe(3);
    expect(impact.lostCount).toBe(1);
  });

  it("没有需求时总条数和有损条数都为 0", () => {
    const attribute: Attribute = { id: "priority", name: "优先级", type: "text", showOnBoard: true, showOnDetail: true };
    const impact = typeChangeImpact([], attribute, "number");
    expect(impact).toEqual({ totalCount: 0, lostCount: 0 });
  });
});

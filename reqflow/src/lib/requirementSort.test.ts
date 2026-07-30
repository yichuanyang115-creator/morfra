import { describe, expect, it } from "vitest";
import {
  defaultStageSort,
  isStageSortCustomized,
  reorderManualOrder,
  sortRequirementsForStage,
} from "./requirementSort";
import type { Requirement } from "../types/models";

interface RequirementOverrides extends Partial<Omit<Requirement, "attributeValues">> {
  priority?: string;
  deadline?: string;
}

function makeRequirement(overrides: RequirementOverrides = {}): Requirement {
  const { priority, deadline, ...rest } = overrides;
  return {
    id: "r-1",
    name: "需求一",
    stage: "design",
    createdAt: "2026-01-01T00:00:00.000Z",
    manualOrder: 0,
    body: "",
    attributeValues: {
      priority: priority ?? "P2",
      source: "内部想法",
      assignee: "",
      deadline: deadline ?? "",
      progress: null,
      release_method: "",
      release_date: "",
      result: null,
    },
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...rest,
  };
}

describe("defaultStageSort / isStageSortCustomized", () => {
  it("默认排序是按创建时间降序的规则模式", () => {
    expect(defaultStageSort()).toEqual({
      mode: "rule",
      primary: "createdAt",
      primaryDir: "desc",
      secondary: null,
      secondaryDir: "desc",
    });
  });

  it("默认排序不算被自定义过", () => {
    expect(isStageSortCustomized(defaultStageSort())).toBe(false);
  });

  it("改变主排序字段后算被自定义过", () => {
    expect(isStageSortCustomized({ ...defaultStageSort(), primary: "priority" })).toBe(true);
  });

  it("改变主排序方向后算被自定义过", () => {
    expect(isStageSortCustomized({ ...defaultStageSort(), primaryDir: "asc" })).toBe(true);
  });

  it("设置了次排序字段后算被自定义过", () => {
    expect(isStageSortCustomized({ ...defaultStageSort(), secondary: "priority" })).toBe(true);
  });

  it("手动模式不算被自定义过，即使字段配置不是默认值", () => {
    expect(isStageSortCustomized({ mode: "manual", primary: "priority", primaryDir: "asc", secondary: null, secondaryDir: "desc" })).toBe(
      false,
    );
  });
});

describe("sortRequirementsForStage — 规则模式", () => {
  it("按优先级升序排列（P0 最靠前）", () => {
    const requirements = [
      makeRequirement({ id: "r-p2", priority: "P2" }),
      makeRequirement({ id: "r-p0", priority: "P0" }),
      makeRequirement({ id: "r-p1", priority: "P1" }),
    ];

    const sorted = sortRequirementsForStage(requirements, {
      mode: "rule",
      primary: "priority",
      primaryDir: "asc",
      secondary: null,
      secondaryDir: "desc",
    });

    expect(sorted.map((r) => r.id)).toEqual(["r-p0", "r-p1", "r-p2"]);
  });

  it("主字段相等时落到次字段排序", () => {
    const requirements = [
      makeRequirement({ id: "r-a", priority: "P0", deadline: "2026-03-01" }),
      makeRequirement({ id: "r-b", priority: "P0", deadline: "2026-01-01" }),
    ];

    const sorted = sortRequirementsForStage(requirements, {
      mode: "rule",
      primary: "priority",
      primaryDir: "asc",
      secondary: "deadline",
      secondaryDir: "asc",
    });

    expect(sorted.map((r) => r.id)).toEqual(["r-b", "r-a"]);
  });

  it("默认排序（创建时间降序）新的在前", () => {
    const requirements = [
      makeRequirement({ id: "r-old", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeRequirement({ id: "r-new", createdAt: "2026-03-01T00:00:00.000Z" }),
    ];

    const sorted = sortRequirementsForStage(requirements, defaultStageSort());

    expect(sorted.map((r) => r.id)).toEqual(["r-new", "r-old"]);
  });

  it("没有截止日期的需求按截止日期排序时被排到最后", () => {
    const requirements = [
      makeRequirement({ id: "r-no-deadline", deadline: "" }),
      makeRequirement({ id: "r-has-deadline", deadline: "2026-01-01" }),
    ];

    const sorted = sortRequirementsForStage(requirements, {
      mode: "rule",
      primary: "deadline",
      primaryDir: "asc",
      secondary: null,
      secondaryDir: "desc",
    });

    expect(sorted.map((r) => r.id)).toEqual(["r-has-deadline", "r-no-deadline"]);
  });
});

describe("sortRequirementsForStage — 手动模式", () => {
  it("按 manualOrder 升序排列", () => {
    const requirements = [
      makeRequirement({ id: "r-a", manualOrder: 2 }),
      makeRequirement({ id: "r-b", manualOrder: 0 }),
      makeRequirement({ id: "r-c", manualOrder: 1 }),
    ];

    const sorted = sortRequirementsForStage(requirements, { ...defaultStageSort(), mode: "manual" });

    expect(sorted.map((r) => r.id)).toEqual(["r-b", "r-c", "r-a"]);
  });
});

describe("reorderManualOrder", () => {
  it("按传入的新顺序生成 0..n-1 的 manualOrder 更新列表", () => {
    const requirements = [makeRequirement({ id: "r-b" }), makeRequirement({ id: "r-c" }), makeRequirement({ id: "r-a" })];

    const updates = reorderManualOrder(requirements);

    expect(updates).toEqual([
      { requirementId: "r-b", manualOrder: 0 },
      { requirementId: "r-c", manualOrder: 1 },
      { requirementId: "r-a", manualOrder: 2 },
    ]);
  });
});

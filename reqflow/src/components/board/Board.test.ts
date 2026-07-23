import { describe, expect, it } from "vitest";
import { resolveDropTransition } from "./Board";
import type { Requirement } from "../../types/models";

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: "r-1",
    name: "需求一",
    stage: "design",
    priority: "P2",
    source: "内部想法",
    assignee: "",
    deadline: "",
    progress: null,
    closureType: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    releaseMethod: "",
    releaseDate: "",
    body: "",
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

describe("resolveDropTransition", () => {
  it("拖到不同阶段区域时返回目标需求 id 和目标阶段", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "design" })];

    const result = resolveDropTransition(requirements, "r-1", "dev");

    expect(result).toEqual({ requirementId: "r-1", toStage: "dev" });
  });

  it("拖拽落点没有命中任何可放置区域（over 为 undefined）时不触发流转", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "design" })];

    const result = resolveDropTransition(requirements, "r-1", undefined);

    expect(result).toBeNull();
  });

  it("拖回同一阶段（原位）时不触发流转", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "design" })];

    const result = resolveDropTransition(requirements, "r-1", "design");

    expect(result).toBeNull();
  });

  it("被拖拽的需求 id 在列表中找不到对应需求时不触发流转（边界：需求已被删除）", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "design" })];

    const result = resolveDropTransition(requirements, "non-existent-id", "dev");

    expect(result).toBeNull();
  });

  it("拖到归档区域时正常返回流转结果，不被特殊排除", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "release" })];

    const result = resolveDropTransition(requirements, "r-1", "archive");

    expect(result).toEqual({ requirementId: "r-1", toStage: "archive" });
  });
});

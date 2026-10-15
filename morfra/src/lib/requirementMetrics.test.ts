import { describe, expect, it } from "vitest";
import { lastTransitionTimestamp, stayDays, totalDays } from "./requirementMetrics";
import type { Requirement } from "../types/models";

interface RequirementOverrides extends Partial<Omit<Requirement, "attributeValues">> {
  closureType?: "completed" | "abandoned" | null;
}

function makeRequirement(overrides: RequirementOverrides = {}): Requirement {
  const { closureType, ...rest } = overrides;
  return {
    id: "r-1",
    name: "需求一",
    stage: "design",
    createdAt: "2026-01-01T00:00:00.000Z",
    manualOrder: 0,
    body: "",
    attributeValues: {
      priority: "P2",
      source: "内部想法",
      assignee: "",
      deadline: "",
      progress: null,
      release_method: "",
      release_date: "",
      result: closureType ?? null,
    },
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...rest,
  };
}

describe("lastTransitionTimestamp", () => {
  it("没有流转记录时返回创建时间", () => {
    const r = makeRequirement({ createdAt: "2026-01-05T00:00:00.000Z", transitions: [] });
    expect(lastTransitionTimestamp(r)).toBe("2026-01-05T00:00:00.000Z");
  });

  it("有流转记录时返回最后一条的时间", () => {
    const r = makeRequirement({
      transitions: [
        { id: "t1", from: "collect", to: "need", timestamp: "2026-01-02T00:00:00.000Z", by: "我", note: "" },
        { id: "t2", from: "need", to: "design", timestamp: "2026-01-10T00:00:00.000Z", by: "我", note: "" },
      ],
    });
    expect(lastTransitionTimestamp(r)).toBe("2026-01-10T00:00:00.000Z");
  });
});

describe("stayDays", () => {
  it("非归档阶段用最后一次流转时间到今天计算", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const r = makeRequirement({
      transitions: [{ id: "t1", from: "collect", to: "design", timestamp: tenDaysAgo, by: "我", note: "" }],
    });
    expect(stayDays(r)).toBe(10);
  });
});

describe("totalDays", () => {
  it("非归档阶段用创建时间到今天计算，随时间持续增长", () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const r = makeRequirement({ stage: "dev", createdAt: twentyDaysAgo });
    expect(totalDays(r)).toBe(20);
  });

  it("归档阶段冻结为创建时间到最后一次流转（归档）时间点的天数，不再随今天增长", () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const r = makeRequirement({
      stage: "archive",
      closureType: "completed",
      createdAt: thirtyDaysAgo,
      transitions: [{ id: "t1", from: "release", to: "archive", timestamp: tenDaysAgo, by: "我", note: "" }],
    });
    // 创建到归档相隔 20 天，而不是创建到"今天"的 30 天
    expect(totalDays(r)).toBe(20);
  });
});

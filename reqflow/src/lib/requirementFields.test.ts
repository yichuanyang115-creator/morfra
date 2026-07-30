import { describe, expect, it } from "vitest";
import type { Requirement } from "../types/models";
import {
  assigneeOf,
  deadlineOf,
  priorityOf,
  progressOf,
  releaseDateOf,
  releaseMethodOf,
  resultOf,
  sourceOf,
  withAttributeValue,
} from "./requirementFields";

function makeRequirement(attributeValues: Record<string, unknown>): Requirement {
  return {
    id: "r-1",
    name: "需求一",
    stage: "design",
    createdAt: "2026-01-01T00:00:00.000Z",
    manualOrder: 0,
    body: "",
    attributeValues,
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
  };
}

describe("字段 getter", () => {
  it("正常值原样读出", () => {
    const r = makeRequirement({
      priority: "P0",
      assignee: "吴桐",
      source: "内部想法",
      deadline: "2026-08-01",
      progress: 40,
      release_method: "灰度",
      release_date: "2026-08-10",
      result: "completed",
    });
    expect(priorityOf(r)).toBe("P0");
    expect(assigneeOf(r)).toBe("吴桐");
    expect(sourceOf(r)).toBe("内部想法");
    expect(deadlineOf(r)).toBe("2026-08-01");
    expect(progressOf(r)).toBe(40);
    expect(releaseMethodOf(r)).toBe("灰度");
    expect(releaseDateOf(r)).toBe("2026-08-10");
    expect(resultOf(r)).toBe("completed");
  });

  it("缺失或类型不匹配的值兜底为安全默认值，不抛错", () => {
    const r = makeRequirement({ priority: 123, progress: "not-a-number" });
    expect(priorityOf(r)).toBe("P2");
    expect(assigneeOf(r)).toBe("");
    expect(sourceOf(r)).toBe("");
    expect(deadlineOf(r)).toBe("");
    expect(progressOf(r)).toBeNull();
    expect(releaseMethodOf(r)).toBe("");
    expect(releaseDateOf(r)).toBe("");
    expect(resultOf(r)).toBeNull();
  });

  it("result 只接受 completed/abandoned，其他值兜底为 null", () => {
    const r = makeRequirement({ result: "something-else" });
    expect(resultOf(r)).toBeNull();
  });
});

describe("withAttributeValue", () => {
  it("返回替换单个属性值后的新对象，不修改原对象", () => {
    const r = makeRequirement({ priority: "P2", assignee: "" });
    const next = withAttributeValue(r, "priority", "P0");

    expect(next).toEqual({ priority: "P0", assignee: "" });
    expect(r.attributeValues).toEqual({ priority: "P2", assignee: "" });
  });
});

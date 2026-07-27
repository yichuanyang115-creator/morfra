import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { AttributeGrid } from "./AttributeGrid";
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
    manualOrder: 0,
    body: "",
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

const noopHandlers = {
  onFieldChange: vi.fn(),
  onProgressChange: vi.fn(),
  onAddSource: vi.fn(),
  onTransition: vi.fn(),
};

describe("AttributeGrid（REQ-003 v2.8：面板逼近 480px 底线时属性区收缩为单列，无中间过渡态）", () => {
  it("compact=false 时渲染两列网格", () => {
    const { container } = render(
      <AttributeGrid requirement={makeRequirement()} sources={[]} compact={false} {...noopHandlers} />,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("58px minmax(0, 1fr) 58px minmax(0, 1fr)");
  });

  it("compact=true 时渲染单列网格", () => {
    const { container } = render(
      <AttributeGrid requirement={makeRequirement()} sources={[]} compact={true} {...noopHandlers} />,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("58px minmax(0, 1fr)");
  });
});

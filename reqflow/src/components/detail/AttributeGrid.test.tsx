import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttributeGrid } from "./AttributeGrid";
import type { Requirement } from "../../types/models";
import type { Attribute } from "../../types/schema";

function makeRequirement(overrides: Partial<Omit<Requirement, "attributeValues">> = {}, attributeValues: Record<string, unknown> = {}): Requirement {
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
    ...overrides,
  };
}

function makeAttribute(overrides: Partial<Attribute>): Attribute {
  return { id: "a", name: "属性", type: "text", showOnBoard: true, showOnDetail: true, ...overrides };
}

const noopHandlers = {
  onAttributeChange: vi.fn(),
  onTransition: vi.fn(),
};

describe("AttributeGrid（REQ-004：属性区从 schema 动态渲染）", () => {
  it("compact=false 时渲染两列网格", () => {
    const { container } = render(
      <AttributeGrid requirement={makeRequirement()} attributes={[]} compact={false} isTerminal={false} {...noopHandlers} />,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("58px minmax(0, 1fr) 58px minmax(0, 1fr)");
  });

  it("compact=true 时渲染单列网格", () => {
    const { container } = render(
      <AttributeGrid requirement={makeRequirement()} attributes={[]} compact={true} isTerminal={false} {...noopHandlers} />,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("58px minmax(0, 1fr)");
  });

  it("按传入的属性列表动态渲染字段标签和值，不写死固定字段", () => {
    const attributes: Attribute[] = [
      makeAttribute({ id: "assignee", name: "负责人", type: "text" }),
      makeAttribute({
        id: "priority",
        name: "优先级",
        type: "singleSelect",
        options: [{ id: "P0", label: "P0" }, { id: "P1", label: "P1" }],
      }),
    ];
    render(
      <AttributeGrid
        requirement={makeRequirement({}, { assignee: "张三", priority: "P0" })}
        attributes={attributes}
        compact={false}
        isTerminal={false}
        {...noopHandlers}
      />,
    );

    expect(screen.getByText("负责人")).toBeInTheDocument();
    expect(screen.getByText("优先级")).toBeInTheDocument();
    expect(screen.getByDisplayValue("张三")).toBeInTheDocument();
  });

  it("增删属性后详情区渲染的字段跟着变（不含未传入的属性）", () => {
    const { rerender } = render(
      <AttributeGrid
        requirement={makeRequirement()}
        attributes={[makeAttribute({ id: "assignee", name: "负责人", type: "text" })]}
        compact={false}
        isTerminal={false}
        {...noopHandlers}
      />,
    );
    expect(screen.getByText("负责人")).toBeInTheDocument();
    expect(screen.queryByText("截止日期")).not.toBeInTheDocument();

    rerender(
      <AttributeGrid
        requirement={makeRequirement()}
        attributes={[makeAttribute({ id: "deadline", name: "截止日期", type: "date" })]}
        compact={false}
        isTerminal={false}
        {...noopHandlers}
      />,
    );
    expect(screen.queryByText("负责人")).not.toBeInTheDocument();
    expect(screen.getByText("截止日期")).toBeInTheDocument();
  });

  it("终态阶段的 result 属性只读展示，不渲染为可交互的 select（REQ-022）", () => {
    const attributes: Attribute[] = [
      makeAttribute({
        id: "result",
        name: "结果",
        type: "singleSelect",
        options: [{ id: "completed", label: "完成" }, { id: "abandoned", label: "废弃" }],
      }),
    ];
    render(
      <AttributeGrid
        requirement={makeRequirement({ stage: "archive" }, { result: "completed" })}
        attributes={attributes}
        compact={false}
        isTerminal={true}
        {...noopHandlers}
      />,
    );

    expect(screen.getByText("完成")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "结果" })).not.toBeInTheDocument();
  });

  it("阶段流转下拉始终渲染（不受 attributes 列表影响，因 Stage 是骨架属性不在 schema.attributes 里）", () => {
    render(
      <AttributeGrid requirement={makeRequirement()} attributes={[]} compact={false} isTerminal={false} {...noopHandlers} />,
    );

    expect(screen.getByLabelText("流转到其他阶段")).toBeInTheDocument();
  });

  it("文本属性失焦时触发 onAttributeChange 带上属性 id 和新值", async () => {
    const onAttributeChange = vi.fn();
    render(
      <AttributeGrid
        requirement={makeRequirement()}
        attributes={[makeAttribute({ id: "assignee", name: "负责人", type: "text" })]}
        compact={false}
        isTerminal={false}
        onAttributeChange={onAttributeChange}
        onTransition={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "李四");
    await userEvent.tab();

    expect(onAttributeChange).toHaveBeenCalledWith("assignee", "李四");
  });

  describe("属性依赖（REQ-025 / 讨论稿 §4.1：详情面板不满足的属性不显示）", () => {
    const dependentAttr = makeAttribute({
      id: "progress",
      name: "进度",
      type: "singleSelect",
      options: [{ id: "done", label: "完成" }],
      dependsOn: { attributeId: "priority", value: "P1" },
    });

    it("依赖条件满足时属性照常显示", () => {
      render(
        <AttributeGrid
          requirement={makeRequirement({}, { priority: "P1", progress: "done" })}
          attributes={[makeAttribute({ id: "priority", name: "优先级" }), dependentAttr]}
          compact={false}
          isTerminal={false}
          {...noopHandlers}
        />,
      );

      expect(screen.getByText("优先级")).toBeInTheDocument();
      expect(screen.getByText("进度")).toBeInTheDocument();
    });

    it("依赖条件不满足时该属性不显示，其他属性不受影响", () => {
      render(
        <AttributeGrid
          requirement={makeRequirement({}, { priority: "P2", progress: "done" })}
          attributes={[makeAttribute({ id: "priority", name: "优先级" }), dependentAttr]}
          compact={false}
          isTerminal={false}
          {...noopHandlers}
        />,
      );

      expect(screen.getByText("优先级")).toBeInTheDocument();
      expect(screen.queryByText("进度")).not.toBeInTheDocument();
    });

    it("依赖源未设置时条件不满足，属性不显示", () => {
      render(
        <AttributeGrid
          requirement={makeRequirement({}, { progress: "done" })}
          attributes={[dependentAttr]}
          compact={false}
          isTerminal={false}
          {...noopHandlers}
        />,
      );

      expect(screen.queryByText("进度")).not.toBeInTheDocument();
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as dndCore from "@dnd-kit/core";
import { StageSection } from "./StageSection";
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
    body: "",
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

describe("StageSection", () => {
  it("useDroppable 返回 isOver=true 时区域和标题栏都带高亮样式", () => {
    const spy = vi.spyOn(dndCore, "useDroppable").mockReturnValue({
      setNodeRef: vi.fn(),
      isOver: true,
    } as unknown as ReturnType<typeof dndCore.useDroppable>);

    const { container } = render(
      <StageSection
        stage="design"
        label="设计"
        requirements={[]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
      />,
    );

    const section = container.querySelector("section");
    expect(section).toHaveClass("bg-(--accent-soft)");
    const header = section?.firstElementChild;
    expect(header).toHaveClass("border-(--accent)");
    spy.mockRestore();
  });

  it("useDroppable 返回 isOver=false 时不带高亮样式", () => {
    const spy = vi.spyOn(dndCore, "useDroppable").mockReturnValue({
      setNodeRef: vi.fn(),
      isOver: false,
    } as unknown as ReturnType<typeof dndCore.useDroppable>);

    const { container } = render(
      <StageSection
        stage="design"
        label="设计"
        requirements={[]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
      />,
    );

    const section = container.querySelector("section");
    expect(section).not.toHaveClass("bg-(--accent-soft)");
    spy.mockRestore();
  });

  it("useDroppable 用阶段 key 作为可放置区域标识注册", () => {
    const spy = vi.spyOn(dndCore, "useDroppable");

    render(
      <StageSection
        stage="dev"
        label="开发"
        requirements={[]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
      />,
    );

    expect(spy).toHaveBeenCalledWith({ id: "dev" });
    spy.mockRestore();
  });

  it("没有需求时显示空状态文案", () => {
    render(
      <StageSection
        stage="design"
        label="设计"
        requirements={[]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
      />,
    );

    expect(screen.getByText("该阶段暂无需求")).toBeInTheDocument();
  });

  it("归档阶段不显示新建按钮", () => {
    render(
      <StageSection
        stage="archive"
        label="归档"
        requirements={[]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("新建需求")).not.toBeInTheDocument();
  });

  it("点击新建按钮出现输入框，输入名称回车后 onCreate 收到去除首尾空格的名称，输入框关闭", async () => {
    const onCreate = vi.fn();
    render(
      <StageSection
        stage="design"
        label="设计"
        requirements={[]}
        selectedRequirementId={null}
        onCreate={onCreate}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("新建需求"));
    const input = screen.getByPlaceholderText("输入名称，回车创建");
    await userEvent.type(input, "  新需求  {Enter}");

    expect(onCreate).toHaveBeenCalledWith("新需求");
    expect(screen.queryByPlaceholderText("输入名称，回车创建")).not.toBeInTheDocument();
  });

  it("点击折叠按钮后不再渲染需求行", async () => {
    render(
      <StageSection
        stage="design"
        label="设计"
        requirements={[makeRequirement({ name: "折叠测试需求" })]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
      />,
    );

    expect(screen.getByText("折叠测试需求")).toBeInTheDocument();
    await userEvent.click(screen.getByText("设计"));
    expect(screen.queryByText("折叠测试需求")).not.toBeInTheDocument();
  });

  it("点击需求行触发 onSelectRequirement 并带上对应需求 id", async () => {
    const onSelectRequirement = vi.fn();
    render(
      <StageSection
        stage="design"
        label="设计"
        requirements={[makeRequirement({ id: "r-9", name: "选中测试需求" })]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={onSelectRequirement}
        onProgressChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText("选中测试需求"));
    expect(onSelectRequirement).toHaveBeenCalledWith("r-9");
  });
});

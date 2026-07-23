import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as dndCore from "@dnd-kit/core";
import { StageSection } from "./StageSection";
import type { Requirement } from "../../types/models";
import { useUiStore } from "../../stores/uiStore";

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

describe("StageSection", () => {
  beforeEach(() => {
    useUiStore.setState({ boardSort: {} });
  });

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
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
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
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
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
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
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
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
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
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
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
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
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
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
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
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText("选中测试需求"));
    expect(onSelectRequirement).toHaveBeenCalledWith("r-9");
  });

  it("归档阶段标题行显示搜索框而不是新建按钮", () => {
    render(
      <StageSection
        stage="archive"
        label="归档"
        requirements={[]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText("搜索归档需求…")).toBeInTheDocument();
    expect(screen.queryByLabelText("新建需求")).not.toBeInTheDocument();
  });

  it("归档区域为空且未搜索时提示还没有归档的需求，输入搜索词无匹配时提示没有匹配的归档需求", async () => {
    render(
      <StageSection
        stage="archive"
        label="归档"
        requirements={[makeRequirement({ stage: "archive", name: "已完成需求" })]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText("搜索归档需求…"), "不存在的关键字");
    expect(screen.getByText("没有匹配的归档需求")).toBeInTheDocument();
  });

  it("归档区域按名称搜索过滤需求行，且按最近流转时间倒序排列", async () => {
    render(
      <StageSection
        stage="archive"
        label="归档"
        requirements={[
          makeRequirement({
            id: "r-old",
            name: "旧的归档需求",
            stage: "archive",
            transitions: [{ id: "t1", from: "release", to: "archive", timestamp: "2026-01-01T00:00:00.000Z", by: "我", note: "" }],
          }),
          makeRequirement({
            id: "r-new",
            name: "新的归档需求",
            stage: "archive",
            transitions: [{ id: "t2", from: "release", to: "archive", timestamp: "2026-02-01T00:00:00.000Z", by: "我", note: "" }],
          }),
        ]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    const rowNames = screen.getAllByText(/归档需求$/).map((el) => el.textContent);
    expect(rowNames).toEqual(["新的归档需求", "旧的归档需求"]);

    await userEvent.type(screen.getByPlaceholderText("搜索归档需求…"), "旧的");
    expect(screen.getByText("旧的归档需求")).toBeInTheDocument();
    expect(screen.queryByText("新的归档需求")).not.toBeInTheDocument();
  });

  it("非归档阶段标题行显示排序控制", () => {
    render(
      <StageSection
        stage="design"
        label="设计"
        requirements={[]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("排序")).toBeInTheDocument();
  });

  it("归档阶段标题行不显示排序控制", () => {
    render(
      <StageSection
        stage="archive"
        label="归档"
        requirements={[]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("排序")).not.toBeInTheDocument();
  });

  it("按主排序字段（优先级升序）渲染需求行顺序", () => {
    useUiStore.getState().setStageSortField("design", "primary", "priority");
    useUiStore.getState().toggleStageSortDir("design", "primary");

    render(
      <StageSection
        stage="design"
        label="设计"
        requirements={[
          makeRequirement({ id: "r-p2", name: "P2需求", priority: "P2" }),
          makeRequirement({ id: "r-p0", name: "P0需求", priority: "P0" }),
        ]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    const names = screen.getAllByText(/需求$/).map((el) => el.textContent);
    expect(names).toEqual(["P0需求", "P2需求"]);
  });

  it("手动模式下按 manualOrder 渲染需求行顺序", () => {
    useUiStore.getState().setStageSortManual("design");

    render(
      <StageSection
        stage="design"
        label="设计"
        requirements={[
          makeRequirement({ id: "r-a", name: "A需求", manualOrder: 2 }),
          makeRequirement({ id: "r-b", name: "B需求", manualOrder: 0 }),
        ]}
        selectedRequirementId={null}
        onCreate={vi.fn()}
        onSelectRequirement={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    const names = screen.getAllByText(/需求$/).map((el) => el.textContent);
    expect(names).toEqual(["B需求", "A需求"]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as dndCore from "@dnd-kit/core";
import { StageSection } from "./StageSection";
import type { Requirement } from "../../types/models";
import type { StageOption } from "../../types/schema";

interface RequirementOverrides extends Partial<Omit<Requirement, "attributeValues">> {
  priority?: string;
}

function makeRequirement(overrides: RequirementOverrides = {}): Requirement {
  const { priority, ...rest } = overrides;
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
      deadline: "",
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

const DESIGN_STAGE: StageOption = { id: "design", label: "设计", color: "#F7FAF1", isTerminal: false };
const DEV_STAGE: StageOption = { id: "dev", label: "开发", color: "#F7FAF1", isTerminal: false };
const COLLECT_STAGE: StageOption = { id: "collect", label: "收集", color: "#F7FAF1", isTerminal: false };
const ARCHIVE_STAGE: StageOption = { id: "archive", label: "归档", color: "#F7FAF1", isTerminal: true };

const noop = {
  attributes: [],
  columnWidths: {},
  frozenCount: 0,
  onCreate: vi.fn(),
  onSelectRequirement: vi.fn(),
  onAttributeChange: vi.fn(),
};

describe("StageSection", () => {
  it("useDroppable 返回 isOver=true 时区域和标题栏都带高亮样式", () => {
    const spy = vi.spyOn(dndCore, "useDroppable").mockReturnValue({
      setNodeRef: vi.fn(),
      isOver: true,
    } as unknown as ReturnType<typeof dndCore.useDroppable>);

    const { container } = render(
      <StageSection stageOption={DESIGN_STAGE} requirements={[]} selectedRequirementId={null} {...noop} />,
    );

    const section = container.querySelector("section");
    expect(section).toHaveClass("bg-(--accent-soft)");
    // 标题栏已提到 section 外（fragment 第一个子元素，sticky 钉在看板滚动层）
    const header = container.firstElementChild;
    expect(header).toHaveClass("border-(--accent)");
    spy.mockRestore();
  });

  it("useDroppable 返回 isOver=false 时不带高亮样式", () => {
    const spy = vi.spyOn(dndCore, "useDroppable").mockReturnValue({
      setNodeRef: vi.fn(),
      isOver: false,
    } as unknown as ReturnType<typeof dndCore.useDroppable>);

    const { container } = render(
      <StageSection stageOption={DESIGN_STAGE} requirements={[]} selectedRequirementId={null} {...noop} />,
    );

    const section = container.querySelector("section");
    expect(section).not.toHaveClass("bg-(--accent-soft)");
    spy.mockRestore();
  });

  it("useDroppable 用阶段 id 作为可放置区域标识注册", () => {
    const spy = vi.spyOn(dndCore, "useDroppable");

    render(<StageSection stageOption={DEV_STAGE} requirements={[]} selectedRequirementId={null} {...noop} />);

    expect(spy).toHaveBeenCalledWith({ id: "dev" });
    spy.mockRestore();
  });

  it("没有需求时显示空状态文案", () => {
    render(<StageSection stageOption={DESIGN_STAGE} requirements={[]} selectedRequirementId={null} {...noop} />);

    expect(screen.getByText("该阶段暂无需求")).toBeInTheDocument();
  });

  it("收集阶段为空时空状态文案带引导语", () => {
    render(<StageSection stageOption={COLLECT_STAGE} requirements={[]} selectedRequirementId={null} {...noop} />);

    expect(screen.getByText("该阶段暂无需求，点上方新建记录你的第一个想法")).toBeInTheDocument();
  });

  it("终态阶段不显示新建按钮", () => {
    render(<StageSection stageOption={ARCHIVE_STAGE} requirements={[]} selectedRequirementId={null} {...noop} />);

    expect(screen.queryByLabelText("新建需求")).not.toBeInTheDocument();
  });

  it("点击新建按钮出现输入框，输入名称回车后 onCreate 收到去除首尾空格的名称，输入框关闭", async () => {
    const onCreate = vi.fn();
    render(
      <StageSection stageOption={DESIGN_STAGE} requirements={[]} selectedRequirementId={null} {...noop} onCreate={onCreate} />,
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
        stageOption={DESIGN_STAGE}
        requirements={[makeRequirement({ name: "折叠测试需求" })]}
        selectedRequirementId={null}
        {...noop}
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
        stageOption={DESIGN_STAGE}
        requirements={[makeRequirement({ id: "r-9", name: "选中测试需求" })]}
        selectedRequirementId={null}
        {...noop}
        onSelectRequirement={onSelectRequirement}
      />,
    );

    await userEvent.click(screen.getByText("选中测试需求"));
    expect(onSelectRequirement).toHaveBeenCalledWith("r-9");
  });

  it("终态阶段标题行显示搜索框而不是新建按钮", () => {
    render(<StageSection stageOption={ARCHIVE_STAGE} requirements={[]} selectedRequirementId={null} {...noop} />);

    expect(screen.getByPlaceholderText("搜索归档需求…")).toBeInTheDocument();
    expect(screen.queryByLabelText("新建需求")).not.toBeInTheDocument();
  });

  it("终态区域为空且未搜索时提示该阶段暂无需求，输入搜索词无匹配时提示没有匹配的需求", async () => {
    render(
      <StageSection
        stageOption={ARCHIVE_STAGE}
        requirements={[makeRequirement({ stage: "archive", name: "已完成需求" })]}
        selectedRequirementId={null}
        {...noop}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText("搜索归档需求…"), "不存在的关键字");
    expect(screen.getByText("没有匹配的需求")).toBeInTheDocument();
  });

  it("终态区域按名称搜索过滤需求行，且按最近流转时间倒序排列", async () => {
    render(
      <StageSection
        stageOption={ARCHIVE_STAGE}
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
        {...noop}
      />,
    );

    const rowNames = screen.getAllByText(/归档需求$/).map((el) => el.textContent);
    expect(rowNames).toEqual(["新的归档需求", "旧的归档需求"]);

    await userEvent.type(screen.getByPlaceholderText("搜索归档需求…"), "旧的");
    expect(screen.getByText("旧的归档需求")).toBeInTheDocument();
    expect(screen.queryByText("新的归档需求")).not.toBeInTheDocument();
  });

  it("非终态阶段标题行显示排序控制", () => {
    render(<StageSection stageOption={DESIGN_STAGE} requirements={[]} selectedRequirementId={null} {...noop} />);

    expect(screen.getByLabelText("排序")).toBeInTheDocument();
  });

  it("终态阶段标题行不显示排序控制", () => {
    render(<StageSection stageOption={ARCHIVE_STAGE} requirements={[]} selectedRequirementId={null} {...noop} />);

    expect(screen.queryByLabelText("排序")).not.toBeInTheDocument();
  });

  it("阶段标题行背景色读取 stageOption.color", () => {
    const { container } = render(
      <StageSection
        stageOption={{ ...DESIGN_STAGE, color: "#ABCDEF" }}
        requirements={[]}
        selectedRequirementId={null}
        {...noop}
      />,
    );

    const header = container.firstElementChild as HTMLElement;
    expect(header.style.backgroundColor).toBe("rgb(171, 205, 239)");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBox } from "./SearchBox";
import type { Requirement } from "../../types/models";

function makeRequirement(overrides: Partial<Omit<Requirement, "attributeValues">> = {}): Requirement {
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
      result: null,
    },
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

describe("SearchBox", () => {
  it("空输入时不展示下拉浮层", () => {
    render(<SearchBox requirements={[]} onJumpToRequirement={vi.fn()} />);

    expect(screen.queryByText("没有匹配的需求")).not.toBeInTheDocument();
  });

  it("聚焦但输入为空白字符时不展示下拉浮层", async () => {
    render(<SearchBox requirements={[]} onJumpToRequirement={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText("搜索需求名称…"), "   ");

    expect(screen.queryByText("没有匹配的需求")).not.toBeInTheDocument();
  });

  it("输入关键字后按名称即时过滤，展示匹配结果及所属阶段", async () => {
    render(
      <SearchBox
        requirements={[
          makeRequirement({ id: "r-1", name: "登录页优化", stage: "dev" }),
          makeRequirement({ id: "r-2", name: "支付流程重构", stage: "design" }),
        ]}
        onJumpToRequirement={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText("搜索需求名称…"), "登录");

    expect(screen.getByText("登录页优化")).toBeInTheDocument();
    expect(screen.getByText("开发")).toBeInTheDocument();
    expect(screen.queryByText("支付流程重构")).not.toBeInTheDocument();
  });

  it("搜索大小写不敏感", async () => {
    render(
      <SearchBox requirements={[makeRequirement({ name: "ABC需求" })]} onJumpToRequirement={vi.fn()} />,
    );

    await userEvent.type(screen.getByPlaceholderText("搜索需求名称…"), "abc");

    expect(screen.getByText("ABC需求")).toBeInTheDocument();
  });

  it("无匹配结果时提示没有匹配的需求", async () => {
    render(
      <SearchBox requirements={[makeRequirement({ name: "登录页优化" })]} onJumpToRequirement={vi.fn()} />,
    );

    await userEvent.type(screen.getByPlaceholderText("搜索需求名称…"), "不存在的关键字");

    expect(screen.getByText("没有匹配的需求")).toBeInTheDocument();
  });

  it("点击结果调用 onJumpToRequirement 并清空输入框、收起浮层", async () => {
    const onJumpToRequirement = vi.fn();
    render(
      <SearchBox
        requirements={[makeRequirement({ id: "r-42", name: "登录页优化" })]}
        onJumpToRequirement={onJumpToRequirement}
      />,
    );

    const input = screen.getByPlaceholderText("搜索需求名称…");
    await userEvent.type(input, "登录");
    await userEvent.click(screen.getByText("登录页优化"));

    expect(onJumpToRequirement).toHaveBeenCalledWith("r-42");
    expect(input).toHaveValue("");
    expect(screen.queryByText("登录页优化")).not.toBeInTheDocument();
  });

  it("点击外部区域后浮层收起", async () => {
    render(
      <div>
        <SearchBox requirements={[makeRequirement({ name: "登录页优化" })]} onJumpToRequirement={vi.fn()} />
        <div data-testid="outside">外部区域</div>
      </div>,
    );

    await userEvent.type(screen.getByPlaceholderText("搜索需求名称…"), "登录");
    expect(screen.getByText("登录页优化")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("outside"));
    expect(screen.queryByText("登录页优化")).not.toBeInTheDocument();
  });

  it("按 Escape 键后浮层收起", async () => {
    render(
      <SearchBox requirements={[makeRequirement({ name: "登录页优化" })]} onJumpToRequirement={vi.fn()} />,
    );

    await userEvent.type(screen.getByPlaceholderText("搜索需求名称…"), "登录");
    expect(screen.getByText("登录页优化")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("登录页优化")).not.toBeInTheDocument();
  });

  it("清空输入框后浮层不再展示（即使仍处于聚焦态）", async () => {
    render(
      <SearchBox requirements={[makeRequirement({ name: "登录页优化" })]} onJumpToRequirement={vi.fn()} />,
    );

    const input = screen.getByPlaceholderText("搜索需求名称…");
    await userEvent.type(input, "登录");
    expect(screen.getByText("登录页优化")).toBeInTheDocument();

    await userEvent.clear(input);
    expect(screen.queryByText("登录页优化")).not.toBeInTheDocument();
    expect(screen.queryByText("没有匹配的需求")).not.toBeInTheDocument();
  });
});

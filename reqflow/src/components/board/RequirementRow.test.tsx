import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as dndCore from "@dnd-kit/core";
import { RequirementRow } from "./RequirementRow";
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

describe("RequirementRow", () => {
  it("useDraggable 返回 isDragging=true 时行整体降低透明度", () => {
    const spy = vi.spyOn(dndCore, "useDraggable").mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      isDragging: true,
    } as unknown as ReturnType<typeof dndCore.useDraggable>);

    const { container } = render(
      <RequirementRow
        requirement={makeRequirement()}
        selected={false}
        onSelect={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    expect(container.firstChild).toHaveClass("opacity-40");
    spy.mockRestore();
  });

  it("useDraggable 返回 isDragging=false 时不带透明度样式", () => {
    const spy = vi.spyOn(dndCore, "useDraggable").mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      isDragging: false,
    } as unknown as ReturnType<typeof dndCore.useDraggable>);

    const { container } = render(
      <RequirementRow
        requirement={makeRequirement()}
        selected={false}
        onSelect={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    expect(container.firstChild).not.toHaveClass("opacity-40");
    spy.mockRestore();
  });

  it("useDraggable 用需求 id 作为拖拽标识注册", () => {
    const spy = vi.spyOn(dndCore, "useDraggable");

    render(
      <RequirementRow
        requirement={makeRequirement({ id: "r-42" })}
        selected={false}
        onSelect={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    expect(spy).toHaveBeenCalledWith({ id: "r-42" });
    spy.mockRestore();
  });

  it("useDraggable 返回的 listeners（拖拽把手事件）被挂载到行元素上", () => {
    const onPointerDown = vi.fn();
    const spy = vi.spyOn(dndCore, "useDraggable").mockReturnValue({
      attributes: {},
      listeners: { onPointerDown },
      setNodeRef: vi.fn(),
      isDragging: false,
    } as unknown as ReturnType<typeof dndCore.useDraggable>);

    const { container } = render(
      <RequirementRow
        requirement={makeRequirement()}
        selected={false}
        onSelect={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    const row = container.firstChild as HTMLElement;
    row.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("点击行内容触发 onSelect", async () => {
    const onSelect = vi.fn();
    render(
      <RequirementRow
        requirement={makeRequirement({ name: "点击测试需求" })}
        selected={false}
        onSelect={onSelect}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText("点击测试需求"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("点击进度输入框不会触发 onSelect（阻止事件冒泡）", async () => {
    const onSelect = vi.fn();
    render(
      <RequirementRow
        requirement={makeRequirement()}
        selected={false}
        onSelect={onSelect}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("spinbutton"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("修改进度输入框并失焦，回调收到限制在 0-100 范围内的整数", async () => {
    const onProgressChange = vi.fn();
    render(
      <RequirementRow
        requirement={makeRequirement()}
        selected={false}
        onSelect={vi.fn()}
        onProgressChange={onProgressChange}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    const input = screen.getByRole("spinbutton");
    await userEvent.clear(input);
    await userEvent.type(input, "150");
    await userEvent.tab();

    expect(onProgressChange).toHaveBeenCalledWith(100);
  });

  it("selected 为 true 时行元素带选中态样式", () => {
    const { container } = render(
      <RequirementRow
        requirement={makeRequirement()}
        selected={true}
        onSelect={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    expect(container.firstChild).toHaveClass("bg-(--accent-soft)");
  });

  it("没有流转记录时，停留天数用创建时间计算，不因缺少流转记录而报错或显示为空", () => {
    render(
      <RequirementRow
        requirement={makeRequirement({ transitions: [], createdAt: "2026-01-01T00:00:00.000Z" })}
        selected={false}
        onSelect={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    const cells = screen.getAllByText(/\d+d/);
    expect(cells.length).toBeGreaterThan(0);
  });

  it("发布阶段行的后两列渲染为发布方式下拉和发布时间选择器，不显示停留天数/总耗时", () => {
    render(
      <RequirementRow
        requirement={makeRequirement({ stage: "release", releaseMethod: "灰度", releaseDate: "2026-02-01" })}
        selected={false}
        onSelect={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("发布方式")).toHaveValue("灰度");
    expect(screen.getByLabelText("发布时间")).toHaveValue("2026-02-01");
    expect(screen.queryByText(/^\d+d$/)).not.toBeInTheDocument();
  });

  it("选择发布方式触发 onReleaseMethodChange，不触发 onSelect", async () => {
    const onSelect = vi.fn();
    const onReleaseMethodChange = vi.fn();
    render(
      <RequirementRow
        requirement={makeRequirement({ stage: "release" })}
        selected={false}
        onSelect={onSelect}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={onReleaseMethodChange}
        onReleaseDateChange={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("发布方式"), "全量");
    expect(onReleaseMethodChange).toHaveBeenCalledWith("全量");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("归档阶段行进度列显示完成/废弃文案，不显示数字进度输入框", () => {
    render(
      <RequirementRow
        requirement={makeRequirement({ stage: "archive", closureType: "abandoned" })}
        selected={false}
        onSelect={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    expect(screen.getByText("废弃")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("归档阶段行完成状态显示完成文案", () => {
    render(
      <RequirementRow
        requirement={makeRequirement({ stage: "archive", closureType: "completed" })}
        selected={false}
        onSelect={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    expect(screen.getByText("完成")).toBeInTheDocument();
  });

  it("归档阶段行第三列显示归档时间（最后一次流转时间），不是持续增长的停留天数", () => {
    render(
      <RequirementRow
        requirement={makeRequirement({
          stage: "archive",
          closureType: "completed",
          transitions: [{ id: "t1", from: "release", to: "archive", timestamp: "2026-01-15T00:00:00.000Z", by: "我", note: "" }],
        })}
        selected={false}
        onSelect={vi.fn()}
        onProgressChange={vi.fn()}
        onReleaseMethodChange={vi.fn()}
        onReleaseDateChange={vi.fn()}
      />,
    );

    expect(screen.getByText("1/15/26")).toBeInTheDocument();
  });
});

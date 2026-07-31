import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as dndSortable from "@dnd-kit/sortable";
import { RequirementRow } from "./RequirementRow";
import type { Requirement } from "../../types/models";
import type { Attribute } from "../../types/schema";

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: "r-1",
    name: "需求一",
    stage: "design",
    createdAt: "2026-01-01T00:00:00.000Z",
    manualOrder: 0,
    body: "",
    attributeValues: {},
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

const PRIORITY_ATTR: Attribute = {
  id: "priority",
  name: "优先级",
  type: "singleSelect",
  options: [
    { id: "P0", label: "P0" },
    { id: "P1", label: "P1" },
    { id: "P2", label: "P2" },
  ],
  showOnBoard: true,
  showOnDetail: true,
};

const RESULT_ATTR: Attribute = {
  id: "result",
  name: "结果",
  type: "singleSelect",
  options: [
    { id: "completed", label: "完成" },
    { id: "abandoned", label: "废弃" },
  ],
  showOnBoard: true,
  showOnDetail: true,
};

function renderRow(overrides: Partial<Parameters<typeof RequirementRow>[0]> = {}) {
  return render(
    <RequirementRow
      requirement={makeRequirement()}
      attributes={[PRIORITY_ATTR]}
      selected={false}
      isTerminal={false}
      onSelect={vi.fn()}
      onAttributeChange={vi.fn()}
      {...overrides}
    />,
  );
}

describe("RequirementRow", () => {
  it("useSortable 返回 isDragging=true 时行整体降低透明度", () => {
    const spy = vi.spyOn(dndSortable, "useSortable").mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      isDragging: true,
      transform: null,
      transition: undefined,
    } as unknown as ReturnType<typeof dndSortable.useSortable>);

    const { container } = renderRow();

    expect(container.firstChild).toHaveClass("opacity-40");
    spy.mockRestore();
  });

  it("useSortable 返回 isDragging=false 时不带透明度样式", () => {
    const spy = vi.spyOn(dndSortable, "useSortable").mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      isDragging: false,
      transform: null,
      transition: undefined,
    } as unknown as ReturnType<typeof dndSortable.useSortable>);

    const { container } = renderRow();

    expect(container.firstChild).not.toHaveClass("opacity-40");
    spy.mockRestore();
  });

  it("useSortable 用需求 id 作为拖拽/排序标识注册", () => {
    const spy = vi.spyOn(dndSortable, "useSortable");

    renderRow({ requirement: makeRequirement({ id: "r-42" }) });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: "r-42" }));
    spy.mockRestore();
  });

  it("终态阶段的行禁用排序拖拽", () => {
    const spy = vi.spyOn(dndSortable, "useSortable");

    renderRow({ isTerminal: true });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }));
    spy.mockRestore();
  });

  it("非终态阶段的行不禁用排序拖拽", () => {
    const spy = vi.spyOn(dndSortable, "useSortable");

    renderRow({ isTerminal: false });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ disabled: false }));
    spy.mockRestore();
  });

  it("useSortable 返回的 listeners（拖拽把手事件）被挂载到行元素上", () => {
    const onPointerDown = vi.fn();
    const spy = vi.spyOn(dndSortable, "useSortable").mockReturnValue({
      attributes: {},
      listeners: { onPointerDown },
      setNodeRef: vi.fn(),
      isDragging: false,
      transform: null,
      transition: undefined,
    } as unknown as ReturnType<typeof dndSortable.useSortable>);

    const { container } = renderRow();

    const row = container.firstChild as HTMLElement;
    row.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("点击行内容触发 onSelect", async () => {
    const onSelect = vi.fn();
    renderRow({ requirement: makeRequirement({ name: "点击测试需求" }), onSelect });

    await userEvent.click(screen.getByText("点击测试需求"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("点击单选下拉不会触发 onSelect（阻止事件冒泡）", async () => {
    const onSelect = vi.fn();
    renderRow({ onSelect });

    await userEvent.click(screen.getByLabelText("优先级"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("按 schema 可见属性遍历渲染 FieldCell，属性数量和顺序跟着 attributes 走", () => {
    const assigneeAttr: Attribute = { id: "assignee", name: "负责人", type: "text", showOnBoard: true, showOnDetail: true };
    renderRow({ attributes: [PRIORITY_ATTR, assigneeAttr] });

    expect(screen.getByLabelText("优先级")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("—")).toBeInTheDocument();
  });

  it("修改优先级触发 onAttributeChange，携带属性 id 和新值", async () => {
    const onAttributeChange = vi.fn();
    renderRow({ requirement: makeRequirement({ attributeValues: { priority: "P2" } }), onAttributeChange });

    await userEvent.selectOptions(screen.getByLabelText("优先级"), "P0");
    expect(onAttributeChange).toHaveBeenCalledWith("priority", "P0");
  });

  it("selected 为 true 时行元素带选中态样式", () => {
    const { container } = renderRow({ selected: true });
    expect(container.firstChild).toHaveClass("bg-(--accent-selected)");
  });

  it("终态阶段下'结果'属性只读，不渲染可交互的下拉", () => {
    renderRow({ attributes: [RESULT_ATTR], isTerminal: true, requirement: makeRequirement({ attributeValues: { result: "completed" } }) });

    expect(screen.getByText("完成")).toBeInTheDocument();
    expect(screen.queryByLabelText("结果")).not.toBeInTheDocument();
  });

  it("非终态阶段下'结果'属性仍可编辑", () => {
    renderRow({ attributes: [RESULT_ATTR], isTerminal: false, requirement: makeRequirement({ attributeValues: { result: null } }) });

    expect(screen.getByLabelText("结果")).toBeInTheDocument();
  });

  it("Name 列固定渲染需求名称，不受 attributes 列表内容影响", () => {
    renderRow({ requirement: makeRequirement({ name: "固定名称测试" }), attributes: [] });
    expect(screen.getByText("固定名称测试")).toBeInTheDocument();
  });
});

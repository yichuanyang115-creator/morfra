import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
      columnWidths={{}}
      frozenCount={0}
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

  it("选中态使用紫色背景和深紫细条，未选中态使用绿色悬停", () => {
    const { container, rerender } = renderRow();
    expect(container.firstChild).toHaveClass("border-l-transparent", "hover:bg-(--module-scope-action-soft)");

    rerender(
      <RequirementRow
        requirement={makeRequirement()}
        attributes={[PRIORITY_ATTR]}
        columnWidths={{}}
        frozenCount={0}
        selected
        isTerminal={false}
        onSelect={vi.fn()}
        onAttributeChange={vi.fn()}
      />,
    );
    expect(container.firstChild).toHaveClass("border-l-(--module-scope-context-strong)", "bg-(--module-scope-context-soft)");
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

  it("右键菜单的永久删除经确认后触发 onDelete", async () => {
    const onDelete = vi.fn();
    const { container } = renderRow({ requirement: makeRequirement({ name: "待删除实体" }), onDelete });

    fireEvent.contextMenu(container.firstChild as HTMLElement, { clientX: 32, clientY: 48 });
    await userEvent.click(screen.getByRole("menuitem", { name: "永久删除" }));
    expect(screen.getByText("永久删除「待删除实体」？")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "永久删除" }));
    expect(onDelete).toHaveBeenCalledOnce();
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
    expect(container.firstChild).toHaveClass("bg-(--module-scope-context-soft)");
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

  describe("列冻结（REQ-001 MUST：从左向右连续扩展，Name 默认冻结）", () => {
    function mockSortable() {
      return vi.spyOn(dndSortable, "useSortable").mockReturnValue({
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        isDragging: false,
        transform: null,
        transition: undefined,
      } as unknown as ReturnType<typeof dndSortable.useSortable>);
    }

    // Name 单元格的 sticky 用 Tailwind 类（left-0）而不是内联 style，style.left 是空串；
    // 冻结列用内联 left 偏移。这里只收集冻结列的偏移，Name 的 sticky 单独断言。
    function frozenLefts(container: HTMLElement): string[] {
      return Array.from(container.querySelectorAll(".sticky"))
        .map((el) => (el as HTMLElement).style.left)
        .filter((left) => left !== "")
        .sort();
    }

    it("frozenCount=0（默认）时只有 Name 单元格是 sticky，属性列不冻结", () => {
      const spy = mockSortable();
      const { container } = renderRow({ attributes: [PRIORITY_ATTR, RESULT_ATTR] });
      expect(container.querySelector(".sticky")).not.toBeNull();
      expect(frozenLefts(container)).toEqual([]);
      spy.mockRestore();
    });

    it("冻结列外包一层 sticky 定位的 div，left 偏移 = Name 最小宽 140 + 列间距 12", () => {
      const spy = mockSortable();
      const { container } = renderRow({ attributes: [PRIORITY_ATTR, RESULT_ATTR], frozenCount: 1, columnWidths: { priority: 90 } });
      // 列宽的存值只影响它右侧列的偏移，不影响它自己：priority 的 left 仍是 152
      expect(frozenLefts(container)).toEqual(["152px"]);
      spy.mockRestore();
    });

    it("冻结属性列继承整行的绿色悬停态", () => {
      const spy = mockSortable();
      const { container } = renderRow({ attributes: [PRIORITY_ATTR], frozenCount: 1 });
      const frozenAttribute = Array.from(container.querySelectorAll(".sticky")).find((element) => (element as HTMLElement).style.left !== "");
      expect(frozenAttribute).toHaveClass("group-hover:bg-(--module-scope-action-soft)");
      spy.mockRestore();
    });

    it("冻结范围跨多列时逐列累加各自的列宽和间距，非冻结列不包 sticky", () => {
      const spy = mockSortable();
      const { container } = renderRow({ attributes: [PRIORITY_ATTR, RESULT_ATTR], frozenCount: 2 });
      // priority(152) + result(152 + 56 + 12 = 220)
      expect(frozenLefts(container)).toEqual(["152px", "220px"]);
      spy.mockRestore();
    });
  });

  describe("属性依赖（REQ-025：看板按行空白，列始终存在）", () => {
    const DEP_ATTR: Attribute = {
      id: "progress",
      name: "进度",
      type: "singleSelect",
      options: [{ id: "done", label: "完成" }],
      showOnBoard: true,
      showOnDetail: true,
      dependsOn: { attributeId: "priority", value: "P1" },
    };

    it("依赖条件满足时正常渲染 FieldCell", () => {
      renderRow({ attributes: [DEP_ATTR], requirement: makeRequirement({ attributeValues: { priority: "P1" } }) });
      expect(screen.getByLabelText("进度")).toBeInTheDocument();
    });

    it("依赖条件不满足时该格为空占位：不渲染交互控件，但列位保留", () => {
      const { container } = renderRow({ attributes: [DEP_ATTR], requirement: makeRequirement({ attributeValues: { priority: "P2" } }) });
      expect(screen.queryByLabelText("进度")).not.toBeInTheDocument();
      // 列位仍占着：渲染出的属性列数不变（空占位 div 替换了 FieldCell）
      const gridChildren = container.firstChild ? container.firstChild.childNodes.length : 0;
      expect(gridChildren).toBe(2); // Name 列 + 该属性列
    });
  });

  describe("阶段覆盖（REQ-025：某阶段下属性列位被替换，覆盖优先于依赖）", () => {
    const TEXT_ATTR: Attribute = { id: "note", name: "备注", type: "text", showOnBoard: true, showOnDetail: true };
    const OVERRIDES = [{ fromAttributeId: "priority", toAttributeId: "note" }];

    it("被覆盖的列位渲染替换属性，原属性不再渲染", () => {
      renderRow({ attributes: [PRIORITY_ATTR], allAttributes: [PRIORITY_ATTR, TEXT_ATTR], overrides: OVERRIDES });
      expect(screen.queryByLabelText("优先级")).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("—")).toBeInTheDocument(); // text cell 输入框
    });

    it("原属性的依赖条件在被覆盖的阶段不生效（覆盖决定占位，原属性依赖被跳过）", () => {
      const DEP_PRIORITY: Attribute = {
        ...PRIORITY_ATTR,
        dependsOn: { attributeId: "source", value: "x" },
      };
      renderRow({
        attributes: [DEP_PRIORITY],
        allAttributes: [DEP_PRIORITY, TEXT_ATTR],
        overrides: OVERRIDES,
        requirement: makeRequirement({ attributeValues: { source: "y" } }),
      });
      // 原属性 priority 的依赖（source=x）本不满足，但被覆盖后不生效，text 属性照常渲染
      expect(screen.getByPlaceholderText("—")).toBeInTheDocument();
    });

    it("被覆盖后占位的属性自身的依赖条件生效", () => {
      const DEP_TEXT: Attribute = { ...TEXT_ATTR, dependsOn: { attributeId: "source", value: "x" } };
      renderRow({
        attributes: [PRIORITY_ATTR],
        allAttributes: [PRIORITY_ATTR, DEP_TEXT],
        overrides: OVERRIDES,
        requirement: makeRequirement({ attributeValues: { source: "y" } }),
      });
      // to 属性 note 的依赖（source=x）不满足 → 该格为空，不渲染输入框
      expect(screen.queryByPlaceholderText("—")).not.toBeInTheDocument();
    });
  });
});

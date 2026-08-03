import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardHeader } from "./BoardHeader";
import type { Attribute } from "../../types/schema";

function makeAttribute(overrides: Partial<Attribute>): Attribute {
  return { id: "a", name: "属性", type: "text", showOnBoard: true, showOnDetail: true, ...overrides };
}

const noop = {
  onEditAttribute: vi.fn(),
  onColumnWidthChange: vi.fn(),
  onColumnWidthCommit: vi.fn(),
};

describe("BoardHeader", () => {
  it("始终渲染名称列，不管传入多少属性", () => {
    render(<BoardHeader attributes={[]} columnWidths={{}} {...noop} />);
    expect(screen.getByText("名称")).toBeInTheDocument();
  });

  it("按传入顺序渲染每个属性的显示名", () => {
    render(
      <BoardHeader
        attributes={[
          makeAttribute({ id: "priority", name: "优先级" }),
          makeAttribute({ id: "assignee", name: "负责人" }),
        ]}
        columnWidths={{}}
        {...noop}
      />,
    );
    const labels = screen.getAllByText(/./).map((el) => el.textContent);
    expect(labels.indexOf("名称")).toBeLessThan(labels.indexOf("优先级"));
    expect(labels.indexOf("优先级")).toBeLessThan(labels.indexOf("负责人"));
  });

  it("右键属性列表头弹出「编辑此属性」菜单，点击后带该属性 id 触发 onEditAttribute", async () => {
    const onEditAttribute = vi.fn();
    render(
      <BoardHeader attributes={[makeAttribute({ id: "priority", name: "优先级" })]} columnWidths={{}} {...noop} onEditAttribute={onEditAttribute} />,
    );

    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByText("优先级") });
    const editItem = await screen.findByText("编辑此属性");
    await userEvent.click(editItem);

    expect(onEditAttribute).toHaveBeenCalledWith("priority");
  });

  it("点击菜单外部关闭菜单，不触发 onEditAttribute", async () => {
    const onEditAttribute = vi.fn();
    render(
      <BoardHeader attributes={[makeAttribute({ id: "priority", name: "优先级" })]} columnWidths={{}} {...noop} onEditAttribute={onEditAttribute} />,
    );

    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByText("优先级") });
    expect(await screen.findByText("编辑此属性")).toBeInTheDocument();

    await userEvent.click(document.body);

    expect(screen.queryByText("编辑此属性")).not.toBeInTheDocument();
    expect(onEditAttribute).not.toHaveBeenCalled();
  });

  describe("列宽拖拽（REQ-001 MUST：拖拽列头右边缘调宽，下限=各自默认宽度，松手后持久化）", () => {
    it("拖拽调宽手柄向右移动时，实时调用 onColumnWidthChange，宽度增量等于鼠标位移", () => {
      const onColumnWidthChange = vi.fn();
      render(
        <BoardHeader
          attributes={[makeAttribute({ id: "priority", type: "singleSelect", name: "优先级" })]}
          columnWidths={{}}
          {...noop}
          onColumnWidthChange={onColumnWidthChange}
        />,
      );
      const handle = screen.getByLabelText("调整「优先级」列宽");

      fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: 140, pointerId: 1 });

      // singleSelect 默认宽度 56，起点即默认宽度，位移 +40 → 96
      expect(onColumnWidthChange).toHaveBeenCalledWith("priority", 96);
    });

    it("拖到比默认宽度还窄时，夹到默认宽度下限，不继续变窄", () => {
      const onColumnWidthChange = vi.fn();
      render(
        <BoardHeader
          attributes={[makeAttribute({ id: "priority", type: "singleSelect", name: "优先级" })]}
          columnWidths={{}}
          {...noop}
          onColumnWidthChange={onColumnWidthChange}
        />,
      );
      const handle = screen.getByLabelText("调整「优先级」列宽");

      fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: -1000, pointerId: 1 });

      expect(onColumnWidthChange).toHaveBeenCalledWith("priority", 56);
    });

    it("松手时调用 onColumnWidthCommit，携带最后一次移动到的宽度（用于持久化）", () => {
      const onColumnWidthCommit = vi.fn();
      render(
        <BoardHeader
          attributes={[makeAttribute({ id: "priority", type: "singleSelect", name: "优先级" })]}
          columnWidths={{}}
          {...noop}
          onColumnWidthCommit={onColumnWidthCommit}
        />,
      );
      const handle = screen.getByLabelText("调整「优先级」列宽");

      fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: 140, pointerId: 1 });
      fireEvent.pointerUp(handle, { clientX: 140, pointerId: 1 });

      expect(onColumnWidthCommit).toHaveBeenCalledWith("priority", 96);
    });

    it("松手后再移动鼠标不再触发 onColumnWidthChange，拖拽状态已结束", () => {
      const onColumnWidthChange = vi.fn();
      render(
        <BoardHeader
          attributes={[makeAttribute({ id: "priority", type: "singleSelect", name: "优先级" })]}
          columnWidths={{}}
          {...noop}
          onColumnWidthChange={onColumnWidthChange}
        />,
      );
      const handle = screen.getByLabelText("调整「优先级」列宽");

      fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: 140, pointerId: 1 });
      fireEvent.pointerUp(handle, { clientX: 140, pointerId: 1 });
      onColumnWidthChange.mockClear();
      fireEvent.pointerMove(handle, { clientX: 200, pointerId: 1 });

      expect(onColumnWidthChange).not.toHaveBeenCalled();
    });

    it("已存的列宽（columnWidths 传入值）作为拖拽起点，而不是类型默认宽度", () => {
      const onColumnWidthChange = vi.fn();
      render(
        <BoardHeader
          attributes={[makeAttribute({ id: "priority", type: "singleSelect", name: "优先级" })]}
          columnWidths={{ priority: 120 }}
          {...noop}
          onColumnWidthChange={onColumnWidthChange}
        />,
      );
      const handle = screen.getByLabelText("调整「优先级」列宽");

      fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: 140, pointerId: 1 });

      expect(onColumnWidthChange).toHaveBeenCalledWith("priority", 160);
    });
  });
});

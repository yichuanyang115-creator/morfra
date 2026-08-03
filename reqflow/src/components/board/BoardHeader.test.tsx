import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardHeader } from "./BoardHeader";
import type { Attribute } from "../../types/schema";

function makeAttribute(overrides: Partial<Attribute>): Attribute {
  return { id: "a", name: "属性", type: "text", showOnBoard: true, showOnDetail: true, ...overrides };
}

describe("BoardHeader", () => {
  it("始终渲染名称列，不管传入多少属性", () => {
    render(<BoardHeader attributes={[]} onEditAttribute={vi.fn()} />);
    expect(screen.getByText("名称")).toBeInTheDocument();
  });

  it("按传入顺序渲染每个属性的显示名", () => {
    render(
      <BoardHeader
        attributes={[
          makeAttribute({ id: "priority", name: "优先级" }),
          makeAttribute({ id: "assignee", name: "负责人" }),
        ]}
        onEditAttribute={vi.fn()}
      />,
    );
    const labels = screen.getAllByText(/./).map((el) => el.textContent);
    expect(labels.indexOf("名称")).toBeLessThan(labels.indexOf("优先级"));
    expect(labels.indexOf("优先级")).toBeLessThan(labels.indexOf("负责人"));
  });

  it("右键属性列表头弹出「编辑此属性」菜单，点击后带该属性 id 触发 onEditAttribute", async () => {
    const onEditAttribute = vi.fn();
    render(<BoardHeader attributes={[makeAttribute({ id: "priority", name: "优先级" })]} onEditAttribute={onEditAttribute} />);

    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByText("优先级") });
    const editItem = await screen.findByText("编辑此属性");
    await userEvent.click(editItem);

    expect(onEditAttribute).toHaveBeenCalledWith("priority");
  });

  it("点击菜单外部关闭菜单，不触发 onEditAttribute", async () => {
    const onEditAttribute = vi.fn();
    render(<BoardHeader attributes={[makeAttribute({ id: "priority", name: "优先级" })]} onEditAttribute={onEditAttribute} />);

    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByText("优先级") });
    expect(await screen.findByText("编辑此属性")).toBeInTheDocument();

    await userEvent.click(document.body);

    expect(screen.queryByText("编辑此属性")).not.toBeInTheDocument();
    expect(onEditAttribute).not.toHaveBeenCalled();
  });
});

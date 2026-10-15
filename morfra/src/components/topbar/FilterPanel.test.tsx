import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterPanel } from "./FilterPanel";
import type { Attribute, FilterCondition } from "../../types/schema";

function makeAttribute(overrides: Partial<Attribute>): Attribute {
  return { id: "a", name: "属性", type: "text", showOnBoard: true, showOnDetail: true, ...overrides };
}

const ATTRIBUTES: Attribute[] = [
  makeAttribute({
    id: "priority",
    name: "优先级",
    type: "singleSelect",
    options: [
      { id: "P0", label: "P0" },
      { id: "P1", label: "P1" },
    ],
  }),
  makeAttribute({ id: "progress", name: "进度", type: "number" }),
  makeAttribute({ id: "desc", name: "描述", type: "text" }),
];

function renderPanel(filters: FilterCondition[] = [], onChange = vi.fn()) {
  const onClose = vi.fn();
  render(<FilterPanel attributes={ATTRIBUTES} filters={filters} onChange={onChange} onClose={onClose} />);
  return { onChange, onClose };
}

describe("FilterPanel（REQ-026 筛选下拉面板）", () => {
  it("没有任何条件时显示空状态引导", () => {
    renderPanel();
    expect(screen.getByText("还没有筛选条件")).toBeInTheDocument();
  });

  it("渲染已有条件的属性名", () => {
    renderPanel([{ attributeId: "priority", operator: "eq", value: "P1" }]);
    expect(screen.getByText("优先级")).toBeInTheDocument();
    expect(screen.getByLabelText("筛选运算符")).toBeInTheDocument();
  });

  it("点添加条件追加一条空条件", async () => {
    const { onChange } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /添加条件/ }));
    expect(onChange).toHaveBeenCalledWith([{ attributeId: "", operator: "eq", value: "" }]);
  });

  it("点删除按钮移除该条件，其余条件保留", async () => {
    const { onChange } = renderPanel([
      { attributeId: "priority", operator: "eq", value: "P1" },
      { attributeId: "progress", operator: "gt", value: 50 },
    ]);
    const removeButtons = screen.getAllByLabelText("删除该筛选条件");
    await userEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith([{ attributeId: "progress", operator: "gt", value: 50 }]);
  });

  it("选择属性后条件更新为对应属性 + 默认运算符 + 空值", async () => {
    const { onChange } = renderPanel([{ attributeId: "", operator: "eq", value: "" }]);
    await userEvent.selectOptions(screen.getByLabelText("筛选属性"), "priority");
    expect(onChange).toHaveBeenCalledWith([{ attributeId: "priority", operator: "eq", value: "" }]);
  });

  it("单选属性选择取值后写入 optionId", async () => {
    const { onChange } = renderPanel([{ attributeId: "priority", operator: "eq", value: "" }]);
    await userEvent.selectOptions(screen.getByLabelText("筛选取值"), "P1");
    expect(onChange).toHaveBeenCalledWith([{ attributeId: "priority", operator: "eq", value: "P1" }]);
  });

  it("数字属性选比较运算符后输入数字写入 number 值", async () => {
    const { onChange } = renderPanel([{ attributeId: "progress", operator: "gt", value: 0 }]);
    const valueInput = screen.getByLabelText("筛选取值");
    await userEvent.clear(valueInput);
    await userEvent.type(valueInput, "80");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith([{ attributeId: "progress", operator: "gt", value: 80 }]);
  });

  it("按 Esc 触发 onClose 关闭面板", () => {
    const { onClose } = renderPanel();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

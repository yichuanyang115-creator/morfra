import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortControl } from "./SortControl";
import type { Attribute } from "../../types/schema";

const ATTRIBUTES: Attribute[] = [
  { id: "priority", name: "优先级", type: "singleSelect", options: [{ id: "P0", label: "P0" }], showOnBoard: true, showOnDetail: true },
  { id: "owner", name: "负责人", type: "text", showOnBoard: true, showOnDetail: true },
  { id: "done", name: "完成", type: "checkbox", showOnBoard: true, showOnDetail: true },
];

function renderControl(overrides: Partial<React.ComponentProps<typeof SortControl>> = {}) {
  return render(
    <SortControl
      rule={null}
      attributes={ATTRIBUTES}
      manual={false}
      hasLocalRule={false}
      onChange={vi.fn()}
      onToggleDirection={vi.fn()}
      onRestore={vi.fn()}
      {...overrides}
    />,
  );
}

describe("SortControl", () => {
  it("只显示 Schema 中允许排序的属性，排除文本和勾选", async () => {
    await userEvent.click(renderControl().getByLabelText("排序"));
    expect(screen.getByRole("option", { name: "优先级" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "负责人" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "完成" })).not.toBeInTheDocument();
  });

  it("选择属性时写出属性 ID 和默认升序", async () => {
    const onChange = vi.fn();
    renderControl({ onChange });
    await userEvent.click(screen.getByLabelText("排序"));
    await userEvent.selectOptions(screen.getByRole("combobox"), "priority");
    expect(onChange).toHaveBeenCalledWith({ attrId: "priority", direction: "asc" });
  });

  it("手动模式显示恢复规则入口", async () => {
    renderControl({ manual: true });
    await userEvent.click(screen.getByLabelText("排序"));
    expect(screen.getByText("已手动调整顺序")).toBeInTheDocument();
    expect(screen.getByText("恢复规则")).toBeInTheDocument();
  });

  it("已配置状态使用紫色上下文，未配置状态使用绿色悬停", () => {
    const { rerender } = renderControl();
    expect(screen.getByLabelText("排序")).toHaveClass("hover:bg-(--accent-soft)", "hover:text-(--accent-text)");

    rerender(
      <SortControl
        rule={null}
        attributes={ATTRIBUTES}
        manual
        hasLocalRule={false}
        onChange={vi.fn()}
        onToggleDirection={vi.fn()}
        onRestore={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("排序")).toHaveClass("bg-(--accent-selected)", "text-(--context-strong)");
  });
});

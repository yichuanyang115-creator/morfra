import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FieldSummary } from "../../../types/domain";
import { EMPTY_VIEW_PIPELINE, type ViewPipelineConfig } from "../../../lib/table/viewPipeline";
import { ViewTools } from "./ViewTools";

const fields: FieldSummary[] = [
  { id: "title", tableId: "table", name: "标题", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "score", tableId: "table", name: "分数", fieldType: "number", isTitle: false, position: 1, config: {}, options: [] },
  { id: "score-copy", tableId: "table", name: "分数", fieldType: "number", isTitle: false, position: 2, config: {}, options: [] },
  { id: "files", tableId: "table", name: "附件", fieldType: "file", isTitle: false, position: 3, config: {}, options: [] },
];

function Harness() {
  const [config, setConfig] = useState<ViewPipelineConfig>(EMPTY_VIEW_PIPELINE);
  const [rowHeight, setRowHeight] = useState<32 | 40 | 56>(40);
  return <ViewTools fields={fields} visibleFieldCount={fields.length - 1} visibleFieldIds={["title", "score"]} config={config} search="" rowHeight={rowHeight} onSearchChange={vi.fn()} onRowHeightChange={setRowHeight} onChange={setConfig} onOpenFieldDisplay={vi.fn()} />;
}

describe("ViewTools", () => {
  it("先选择真实字段，再创建展开的类型化筛选卡片；隐藏和同名字段均可选", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "筛选" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "＋ 添加筛选条件" }));
    const picker = screen.getByRole("listbox", { name: "选择筛选字段" });
    expect(picker.querySelectorAll('[role="option"]')).toHaveLength(4);
    expect(screen.getByRole("option", { name: /标题/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /分数.*已隐藏/ })).toBeTruthy();
    await user.click(screen.getAllByRole("option", { name: /分数/ })[0]);
    expect(screen.getByRole("option", { name: "大于" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "介于" })).toBeNull();
    expect(screen.getByLabelText("分数 筛选值")).toHaveAttribute("type", "number");
    expect(screen.getByRole("button", { name: "筛选" })).not.toHaveAccessibleName(/1 项/);
  });

  it("完整条件即时生效、按钮计数，并在重开时收起为摘要", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "筛选" }));
    await user.click(screen.getByRole("button", { name: "＋ 添加筛选条件" }));
    await user.click(screen.getByRole("option", { name: /标题/ }));
    await user.type(screen.getByLabelText("标题 筛选值"), "需求");
    await waitFor(() => expect(screen.getByRole("button", { name: "筛选，1 项" })).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "筛选，1 项" }));
    await user.click(screen.getByRole("button", { name: "筛选，1 项" }));
    expect(screen.getByText("标题 包含 需求")).toBeTruthy();
  });

  it("排序先选可排序字段，隐藏字段可选，已选与附件字段不会再次出现", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "排序" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "＋ 添加排序字段" }));
    screen.getByRole("listbox", { name: "选择排序字段" });
    expect(screen.queryByRole("option", { name: /附件/ })).toBeNull();
    expect(screen.getByRole("option", { name: /分数.*已隐藏/ })).toBeTruthy();
    await user.click(screen.getByRole("option", { name: /标题/ }));
    expect(screen.getByLabelText("标题 排序方向")).toHaveValue("asc");
    expect(screen.getByRole("button", { name: "排序，1 项" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "＋ 添加排序字段" }));
    expect(screen.queryByRole("option", { name: /标题/ })).toBeNull();
  });

  it("排序规则提供方向和键盘可达的优先级调整", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "排序" }));
    await user.click(screen.getByRole("button", { name: "＋ 添加排序字段" }));
    await user.click(screen.getByRole("option", { name: /标题/ }));
    await user.selectOptions(screen.getByLabelText("标题 排序方向"), "desc");
    expect(screen.getByLabelText("标题 排序方向")).toHaveValue("desc");
    await user.click(screen.getByRole("button", { name: "＋ 添加排序字段" }));
    await user.click(screen.getAllByRole("option", { name: /分数/ })[0]);
    expect(screen.getByRole("button", { name: "上移 分数 排序" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "上移 分数 排序" }));
    expect(screen.getByRole("button", { name: "下移 分数 排序" })).toBeTruthy();
  });

  it("条件填色规则支持复制和启停", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "条件填色" }));
    await user.click(screen.getByRole("button", { name: "添加规则" }));
    await user.click(screen.getByRole("button", { name: "复制填色规则" }));
    expect(screen.getAllByLabelText("启用条件填色")).toHaveLength(2);
    await user.click(screen.getAllByLabelText("启用条件填色")[0]);
    expect(screen.getAllByLabelText("启用条件填色")[0]).not.toBeChecked();
  });

  it("复杂浮层锚定在触发按钮内，Esc 关闭后回到触发按钮", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "筛选" });
    await user.click(trigger);
    expect(trigger.parentElement?.querySelector('[role="dialog"]')).toHaveAccessibleName("筛选");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "筛选" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("表格工具栏把新建记录保留在最右侧主操作", async () => {
    const onCreateRecord = vi.fn();
    const user = userEvent.setup();
    render(<ViewTools fields={fields} visibleFieldCount={fields.length} config={EMPTY_VIEW_PIPELINE} search="" rowHeight={40} onSearchChange={vi.fn()} onRowHeightChange={vi.fn()} onChange={vi.fn()} onOpenFieldDisplay={vi.fn()} onCreateRecord={onCreateRecord} />);
    await user.click(screen.getByRole("button", { name: "新建记录" }));
    expect(onCreateRecord).toHaveBeenCalledOnce();
  });

  it("行高只保留单一文字入口，并以菜单对号同步当前视图状态", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "行高" });
    expect(screen.queryByRole("combobox", { name: "行高" })).toBeNull();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitemradio", { name: "标准" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "紧凑" })).toHaveAttribute("aria-checked", "false");
    await user.click(screen.getByRole("menuitemradio", { name: "宽松" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(screen.getByRole("menuitemradio", { name: "宽松" })).toHaveAttribute("aria-checked", "true");
  });

  it("行高菜单支持键盘选择、Esc 关闭和焦点恢复", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "行高" });
    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(trigger).toHaveFocus();
    await user.keyboard(" {Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

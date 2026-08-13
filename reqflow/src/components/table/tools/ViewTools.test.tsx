import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FieldSummary } from "../../../types/domain";
import { EMPTY_VIEW_PIPELINE, type ViewPipelineConfig } from "../../../lib/table/viewPipeline";
import { ViewTools } from "./ViewTools";

const fields: FieldSummary[] = [
  { id: "title", tableId: "table", groupId: null, name: "标题", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "score", tableId: "table", groupId: null, name: "分数", fieldType: "number", isTitle: false, position: 1, config: {}, options: [] },
  { id: "files", tableId: "table", groupId: null, name: "附件", fieldType: "file", isTitle: false, position: 2, config: {}, options: [] },
];

function Harness() {
  const [config, setConfig] = useState<ViewPipelineConfig>(EMPTY_VIEW_PIPELINE);
  const [rowHeight, setRowHeight] = useState<32 | 40 | 56>(40);
  return <ViewTools fields={fields} visibleFieldCount={fields.length} config={config} search="" rowHeight={rowHeight} onSearchChange={vi.fn()} onRowHeightChange={setRowHeight} onChange={setConfig} onOpenFieldDisplay={vi.fn()} />;
}

describe("ViewTools", () => {
  it("按字段类型切换筛选运算符，并提供数值区间输入", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "筛选" }));
    await user.click(screen.getByRole("button", { name: "添加条件" }));
    await user.selectOptions(screen.getByLabelText("筛选字段"), "score");
    expect(screen.getByRole("option", { name: "介于" })).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("筛选条件"), "between");
    expect(screen.getByLabelText("筛选值起始")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("筛选值结束")).toHaveAttribute("type", "number");
  });

  it("附件字段提供数量比较和数值输入", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "筛选" }));
    await user.click(screen.getByRole("button", { name: "添加条件" }));
    await user.selectOptions(screen.getByLabelText("筛选字段"), "files");
    await user.selectOptions(screen.getByLabelText("筛选条件"), "fileCountGreaterThan");
    expect(screen.getByLabelText("筛选值")).toHaveAttribute("type", "number");
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

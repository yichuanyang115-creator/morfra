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
  return <ViewTools fields={fields} visibleFieldCount={fields.length} config={config} search="" rowHeight={40} onSearchChange={vi.fn()} onRowHeightChange={vi.fn()} onChange={setConfig} onOpenFieldDisplay={vi.fn()} />;
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
});

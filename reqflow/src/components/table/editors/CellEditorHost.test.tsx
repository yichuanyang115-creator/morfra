import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FieldSummary } from "../../../types/domain";
import { CellEditorHost } from "./CellEditorHost";

function field(fieldType: FieldSummary["fieldType"]): FieldSummary {
  return { id: "field", tableId: "table", groupId: null, name: "字段", fieldType, isTitle: false, position: 0, config: {}, options: [{ id: "one", fieldId: "field", name: "选项一", color: "blue", position: 0 }] };
}

describe("CellEditorHost", () => {
  it("单选立即提交，多选保留草稿直到 Return", () => {
    const single = vi.fn();
    const { rerender } = render(<CellEditorHost field={field("select")} value={null} label="单选" error={null} onChange={vi.fn()} onCommit={single} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "选项一" }));
    expect(single).toHaveBeenCalled();

    const change = vi.fn();
    const multi = vi.fn();
    rerender(<CellEditorHost field={field("multi_select")} value={[]} label="多选" error={null} onChange={change} onCommit={multi} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "选项一" }));
    expect(change).toHaveBeenCalledWith(["one"]);
    expect(multi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "清空选择" }));
    expect(change).toHaveBeenCalledWith([]);
    expect(multi).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "编辑字段" }), { key: "Enter" });
    expect(multi).toHaveBeenCalled();
  });

  it("日期、链接与进度都提供对应的受控输入入口", () => {
    const props = { label: "编辑", error: null, onChange: vi.fn(), onCommit: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<CellEditorHost field={field("date")} value={"2026-08-10"} {...props} />);
    expect(screen.getByLabelText("编辑")).toHaveAttribute("type", "date");
    rerender(<CellEditorHost field={field("link")} value={"https://example.com"} {...props} />);
    expect(screen.getByLabelText("编辑")).toHaveAttribute("type", "url");
    rerender(<CellEditorHost field={field("progress")} value={20} {...props} />);
    expect(screen.getByLabelText("编辑")).toHaveAttribute("type", "number");
  });

  it("日期和多行文本都遵守 Return / Shift + Return 的提交移动合同", () => {
    const dateCommit = vi.fn();
    const props = { label: "编辑", error: null, onChange: vi.fn(), onCommit: dateCommit, onCancel: vi.fn() };
    const { rerender } = render(<CellEditorHost field={field("date")} value={"2026-08-10"} {...props} />);
    fireEvent.keyDown(screen.getByLabelText("编辑"), { key: "Enter" });
    fireEvent.keyDown(screen.getByLabelText("编辑"), { key: "Enter", shiftKey: true });
    fireEvent.keyDown(screen.getByLabelText("编辑"), { key: "Tab" });
    fireEvent.keyDown(screen.getByLabelText("编辑"), { key: "Tab", shiftKey: true });
    expect(dateCommit).toHaveBeenNthCalledWith(1, "down");
    expect(dateCommit).toHaveBeenNthCalledWith(2, "up");
    expect(dateCommit).toHaveBeenNthCalledWith(3, "right");
    expect(dateCommit).toHaveBeenNthCalledWith(4, "left");

    const textCommit = vi.fn();
    rerender(<CellEditorHost field={{ ...field("text"), config: { multiline: true } }} value={"多行"} label="多行编辑" error={null} onChange={vi.fn()} onCommit={textCommit} onCancel={vi.fn()} />);
    fireEvent.keyDown(screen.getByLabelText("多行编辑"), { key: "Enter" });
    expect(textCommit).toHaveBeenCalledWith("down");
  });

  it("单选和多选都遵守 Return、Tab 与 Shift+Tab 的提交移动合同", () => {
    const singleCommit = vi.fn();
    const { unmount } = render(<CellEditorHost field={field("select")} value={null} label="单选" error={null} onChange={vi.fn()} onCommit={singleCommit} onCancel={vi.fn()} />);
    const singleOption = screen.getByRole("button", { name: "选项一" });
    singleOption.focus();
    fireEvent.keyDown(singleOption, { key: "Enter" });
    expect(singleCommit).toHaveBeenCalledWith("down");
    unmount();

    const multiCommit = vi.fn();
    render(<CellEditorHost field={field("multi_select")} value={["one"]} label="多选" error={null} onChange={vi.fn()} onCommit={multiCommit} onCancel={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "编辑字段" });
    fireEvent.keyDown(dialog, { key: "Tab" });
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(multiCommit).toHaveBeenNthCalledWith(1, "right");
    expect(multiCommit).toHaveBeenNthCalledWith(2, "left");
  });

  it("复选框编辑态遵守 Return、Tab、Shift 与 Esc 合同", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<CellEditorHost field={field("checkbox")} value={false} label="复选框" error={null} onChange={vi.fn()} onCommit={onCommit} onCancel={onCancel} />);
    const checkbox = screen.getByRole("button", { name: "复选框" });
    fireEvent.keyDown(checkbox, { key: "Enter" });
    fireEvent.keyDown(checkbox, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(checkbox, { key: "Tab" });
    fireEvent.keyDown(checkbox, { key: "Tab", shiftKey: true });
    fireEvent.keyDown(checkbox, { key: "Escape" });

    expect(onCommit).toHaveBeenNthCalledWith(1, "down");
    expect(onCommit).toHaveBeenNthCalledWith(2, "up");
    expect(onCommit).toHaveBeenNthCalledWith(3, "right");
    expect(onCommit).toHaveBeenNthCalledWith(4, "left");
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

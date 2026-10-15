import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FieldDisplayManager } from "./FieldDisplayManager";
import type { FieldSummary } from "../../types/domain";

const fields: FieldSummary[] = [
  { id: "title", tableId: "table", groupId: null, name: "标题", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "status", tableId: "table", groupId: "group-a", name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [] },
  { id: "owner", tableId: "table", groupId: null, name: "负责人", fieldType: "text", isTitle: false, position: 2, config: {}, options: [] },
];

describe("FieldDisplayManager", () => {
  it("隐藏单个字段时提交完整剩余字段列表，而不是只提交最近操作字段", async () => {
    const onChange = vi.fn(); const user = userEvent.setup();
    render(<FieldDisplayManager fields={fields} selectedIds={["title", "status", "owner"]} onChange={onChange} onClose={vi.fn()} />);
    await user.click(screen.getByRole("checkbox", { name: "状态" }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1]?.[0]).toEqual(["title", "owner"]);
  });

  it("隐藏字段后仍允许恢复，并保持主标题", async () => {
    const onChange = vi.fn(); const user = userEvent.setup();
    render(<FieldDisplayManager fields={fields} selectedIds={["title"]} onChange={onChange} onClose={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "状态" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "状态" }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1]?.[0]).toEqual(["title", "status"]);

  });

  it("提供当前视图列顺序的键盘等价操作，并保留隐藏字段标识", async () => {
    const onChange = vi.fn(); const user = userEvent.setup();
    const { rerender } = render(<FieldDisplayManager fields={fields} selectedIds={["title", "status", "owner"]} onChange={onChange} onClose={vi.fn()} onReset={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "上移 负责人 字段" }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1]?.[0]).toEqual(["title", "owner", "status"]);
    await user.click(screen.getByRole("button", { name: "隐藏其他字段" }));
    rerender(<FieldDisplayManager fields={fields} selectedIds={["title"]} onChange={onChange} onClose={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getAllByText("已隐藏")).toHaveLength(2);
  });
});

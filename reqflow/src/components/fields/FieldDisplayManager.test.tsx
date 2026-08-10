import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FieldDisplayManager } from "./FieldDisplayManager";
import type { FieldGroupSummary, FieldSummary } from "../../types/domain";

const fields: FieldSummary[] = [
  { id: "title", tableId: "table", groupId: null, name: "标题", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "status", tableId: "table", groupId: "group-a", name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [] },
  { id: "owner", tableId: "table", groupId: null, name: "负责人", fieldType: "text", isTitle: false, position: 2, config: {}, options: [] },
];

const groups: FieldGroupSummary[] = [
  { id: "group-a", tableId: "table", name: "阶段", position: 0 },
  { id: "group-b", tableId: "table", name: "空组", position: 1 },
];

describe("FieldDisplayManager", () => {
  it("隐藏单个字段时提交完整剩余字段列表，而不是只提交最近操作字段", async () => {
    const onChange = vi.fn(); const user = userEvent.setup();
    render(<FieldDisplayManager fields={fields} groups={groups} selectedIds={["title", "status", "owner"]} onChange={onChange} onClose={vi.fn()} />);
    await user.click(screen.getByRole("checkbox", { name: "状态" }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1]?.[0]).toEqual(["title", "owner"]);
  });

  it("全隐藏组和空组仍显示为可排序区块，并在恢复字段时保留主标题", async () => {
    const onChange = vi.fn(); const user = userEvent.setup();
    render(<FieldDisplayManager fields={fields} groups={groups} selectedIds={["title"]} onChange={onChange} onClose={vi.fn()} />);

    expect(screen.getByTestId("field-group-group-a")).toHaveTextContent("阶段");
    expect(screen.getByTestId("field-group-group-b")).toHaveTextContent("空组");
    expect(screen.getByRole("checkbox", { name: "状态" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "状态" }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1]?.[0]).toEqual(["title", "status"]);

    fireEvent.dragStart(screen.getByTestId("field-group-group-b"), { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(screen.getByTestId("field-group-group-a"));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1]?.[1]).toEqual(["group-b", "group-a", "ungrouped"]);
  });

  it("拖拽组块时同时回传按新 groupOrder 排列的字段", () => {
    const onChange = vi.fn();
    render(<FieldDisplayManager fields={fields} groups={groups} selectedIds={["title", "status", "owner"]} onChange={onChange} onClose={vi.fn()} />);

    fireEvent.dragStart(screen.getByTestId("field-group-ungrouped"), { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(screen.getByTestId("field-group-group-a"));

    expect(onChange.mock.calls[onChange.mock.calls.length - 1]).toEqual([
      ["title", "owner", "status"],
      ["ungrouped", "group-a", "group-b"],
    ]);
  });

  it("不能把字段组拖到主标题块", () => {
    const onChange = vi.fn();
    render(<FieldDisplayManager fields={fields} groups={groups} selectedIds={["title", "status", "owner"]} onChange={onChange} onClose={vi.fn()} />);

    fireEvent.dragStart(screen.getByTestId("field-group-ungrouped"), { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(screen.getByTestId("field-group-title"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("不能把普通字段拖到主标题字段", () => {
    const onChange = vi.fn();
    render(<FieldDisplayManager fields={fields} groups={groups} selectedIds={["title", "status", "owner"]} onChange={onChange} onClose={vi.fn()} />);

    fireEvent.dragStart(screen.getByText("负责人"), { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(screen.getByText("标题 · 主标题"));

    expect(onChange).not.toHaveBeenCalled();
  });
});

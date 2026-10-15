import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableList } from "./TableList";

const tables = [{ id: "table-1", name: "已有表", emoji: "📋", position: 0, titleFieldId: "field-1", recordCount: 0, views: [] }];

function renderList(onCreate = vi.fn().mockResolvedValue(undefined)) {
  const result = render(<TableList tables={tables} activeTableId="table-1" createRequest={1} onSelect={vi.fn()} onCreate={onCreate} onRename={vi.fn()} onEmojiChange={vi.fn()} onDelete={vi.fn()} onReorder={vi.fn()} />);
  return { ...result, onCreate };
}

describe("TableList 新建表命名", () => {
  it("把命名输入框追加在现有表项末尾并立即聚焦", () => {
    const { container } = renderList();
    const list = container.querySelector(".morfra-table-list-scroll")!;
    const input = screen.getByRole("textbox", { name: "新表名称" });

    expect(input).toHaveFocus();
    expect(list.lastElementChild).toContainElement(input);
  });

  it("空白失焦取消，Esc 取消后焦点回到触发按钮", async () => {
    const trigger = document.createElement("button");
    trigger.setAttribute("aria-label", "新建表");
    document.body.append(trigger);
    trigger.focus();
    const { rerender } = renderList();
    const input = screen.getByRole("textbox", { name: "新表名称" });

    fireEvent.blur(input);
    expect(screen.queryByRole("textbox", { name: "新表名称" })).not.toBeInTheDocument();

    trigger.focus();
    rerender(<TableList tables={tables} activeTableId="table-1" createRequest={2} onSelect={vi.fn()} onCreate={vi.fn()} onRename={vi.fn()} onEmojiChange={vi.fn()} onDelete={vi.fn()} onReorder={vi.fn()} />);
    const reopened = screen.getByRole("textbox", { name: "新表名称" });
    fireEvent.change(reopened, { target: { value: "会取消" } });
    fireEvent.keyDown(reopened, { key: "Escape" });

    await waitFor(() => expect(trigger).toHaveFocus());
    rerender(<></>);
    trigger.remove();
  });

  it("有效名称在 Enter 或失焦时只提交一次，并去除首尾空格", async () => {
    const { onCreate } = renderList();
    const input = screen.getByRole("textbox", { name: "新表名称" });

    fireEvent.change(input, { target: { value: "  新表  " } });
    fireEvent.submit(input.closest("form")!);
    fireEvent.blur(input);

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith("新表");
  });

  it("保存失败时保留名称和错误，允许 Esc 取消", async () => {
    const { onCreate } = renderList(vi.fn().mockRejectedValue(new Error("保存失败")));
    const input = screen.getByRole("textbox", { name: "新表名称" });

    fireEvent.change(input, { target: { value: "重试表" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("新建表失败，请重试"));
    expect(input).toHaveValue("重试表");
    expect(onCreate).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "新表名称" })).not.toBeInTheDocument();
  });
});

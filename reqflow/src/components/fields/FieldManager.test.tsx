import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TableDataSnapshot } from "../../types/domain";
import { FieldManager } from "./FieldManager";

vi.mock("../../lib/ipc/storageClient", () => ({ getStorageActivityBinding: vi.fn().mockResolvedValue({ fieldId: null }) }));

const data: TableDataSnapshot = {
  tableId: "table",
  titleFieldId: "title",
  fields: [
    { id: "title", tableId: "table", groupId: null, name: "标题", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
    { id: "status", tableId: "table", groupId: null, name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [] },
    { id: "owner", tableId: "table", groupId: null, name: "负责人", fieldType: "text", isTitle: false, position: 2, config: {}, options: [] },
  ],
  records: [],
};

afterEach(() => document.querySelector("[data-testid='field-manager-anchor']")?.remove());

function renderManager() {
  const anchor = document.createElement("button"); anchor.dataset.testid = "field-manager-anchor"; document.body.append(anchor);
  Object.defineProperty(anchor, "getBoundingClientRect", { value: () => ({ left: 500, right: 600, top: 80, bottom: 110 }) });
  const onClose = vi.fn();
  const onChange = vi.fn();
  render(<FieldManager tableId="table" data={data} anchor={anchor} onClose={onClose} onError={vi.fn()} viewLayout={{ visibleFieldIds: ["title", "status", "owner"], fieldOrder: ["title", "status", "owner"], onChange, onFieldCreated: vi.fn(), onReset: vi.fn() }} />);
  return { anchor, onClose, onChange };
}

describe("FieldManager", () => {
  it("以非模态锚定浮层打开，编辑页提供草稿取消和保存并可返回原编辑入口", async () => {
    const user = userEvent.setup(); renderManager();
    const dialog = screen.getByRole("dialog", { name: "字段管理" });
    expect(dialog).toHaveAttribute("aria-modal", "false");
    expect(dialog).toHaveStyle({ position: "fixed", width: "280px", left: "320px" });
    await user.click(screen.getByRole("button", { name: "编辑字段 状态" }));
    expect(screen.queryByLabelText("字段名称")).toBeNull();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "返回字段列表" }));
    expect(screen.getByText("字段管理")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "编辑字段 状态" })).toHaveFocus());
  });

  it("点击浮层外部时关闭且不强制返还焦点", () => {
    const { onClose } = renderManager();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("普通字段提供紧凑拖拽把手和键盘排序，主标题保持首位", () => {
    const { onChange } = renderManager();
    const handle = screen.getByRole("button", { name: "拖动 状态 字段排序" });
    expect(handle).toHaveClass("morfra-field-drag-handle");
    expect(handle.querySelector("svg")).toHaveAttribute("width", "10");

    fireEvent.keyDown(screen.getByRole("button", { name: "拖动 负责人 字段排序" }), { altKey: true, key: "ArrowUp" });

    expect(onChange).toHaveBeenCalledWith(["title", "owner", "status"], ["title", "status", "owner"]);
    expect(screen.queryByLabelText("拖动 标题 字段排序")).toBeNull();
  });
});

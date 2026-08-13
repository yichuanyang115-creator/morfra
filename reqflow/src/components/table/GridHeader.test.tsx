import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ColumnLayout } from "../../lib/table/columnLayout";
import type { FieldSummary } from "../../types/domain";
import { GridHeader } from "./GridHeader";

const title: FieldSummary = { id: "title", tableId: "table-1", groupId: null, name: "名称", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] };
const status: FieldSummary = { id: "status", tableId: "table-1", groupId: "group-a", name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [] };
const owner: FieldSummary = { id: "owner", tableId: "table-1", groupId: "group-b", name: "负责人", fieldType: "text", isTitle: false, position: 2, config: {}, options: [] };
const layouts: ColumnLayout[] = [{ field: title, width: 240, frozen: true }, { field: status, width: 200, frozen: false }, { field: owner, width: 200, frozen: false }];

describe("GridHeader 冻结菜单", () => {
  it("通过字段菜单显式冻结至列并取消额外冻结", () => {
    const onFreezeTo = vi.fn(); const onClearExtraFreeze = vi.fn();
    render(<GridHeader layouts={layouts} groupNames={{ "group-a": "阶段", "group-b": "负责人" }} rowHeight={40} collapsedGroupIds={[]} onToggleGroup={vi.fn()} onReorderGroup={vi.fn()} onResize={vi.fn()} onAutoFit={vi.fn()} onFreezeTo={onFreezeTo} onClearExtraFreeze={onClearExtraFreeze} />);
    fireEvent.click(screen.getByRole("button", { name: "打开 状态 字段菜单" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "冻结至此列" }));
    expect(onFreezeTo).toHaveBeenCalledWith("status");
    fireEvent.click(screen.getByRole("button", { name: "打开 状态 字段菜单" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "取消额外冻结" }));
    expect(onClearExtraFreeze).toHaveBeenCalledOnce();
  });

  it("直接拖拽字段组带时上报组块重排", () => {
    const onReorderGroup = vi.fn();
    render(<GridHeader layouts={layouts} groupNames={{ "group-a": "阶段", "group-b": "负责人" }} rowHeight={40} collapsedGroupIds={[]} onToggleGroup={vi.fn()} onReorderGroup={onReorderGroup} onResize={vi.fn()} onAutoFit={vi.fn()} onFreezeTo={vi.fn()} onClearExtraFreeze={vi.fn()} />);
    fireEvent.dragStart(screen.getByText("⌄ 阶段").parentElement!, { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(screen.getByText("⌄ 负责人").parentElement!);
    expect(onReorderGroup).toHaveBeenCalledWith("group-a", "group-b");
  });

  it("字段类型只作为装饰图标，类型文字只在更多菜单中出现，并支持快速添加字段", async () => {
    const onCreateField = vi.fn().mockResolvedValue("new-field");
    render(<GridHeader layouts={layouts} groupNames={{ "group-a": "阶段", "group-b": "负责人" }} rowHeight={40} collapsedGroupIds={[]} onCreateField={onCreateField} onToggleGroup={vi.fn()} onReorderGroup={vi.fn()} onResize={vi.fn()} onAutoFit={vi.fn()} onFreezeTo={vi.fn()} onClearExtraFreeze={vi.fn()} />);
    expect(screen.queryByText("文本")).toBeNull();
    expect(screen.getAllByText("T")[0]).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(screen.getByRole("button", { name: "打开 状态 字段菜单" }));
    expect(screen.getByText("类型：单选")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "＋ 添加字段" }));
    fireEvent.click(screen.getByRole("option", { name: "数字" }));
    await waitFor(() => expect(onCreateField).toHaveBeenCalledWith("number", "数字"));
  });
});

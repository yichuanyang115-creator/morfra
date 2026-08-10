import { fireEvent, render, screen } from "@testing-library/react";
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
});

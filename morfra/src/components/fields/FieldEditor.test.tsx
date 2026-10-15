import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FieldSummary } from "../../types/domain";
import { FieldEditor } from "./FieldEditor";

const field: FieldSummary = { id: "status", tableId: "table", groupId: null, name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [] };
function renderRow(overrides: Partial<Parameters<typeof FieldEditor>[0]> = {}) { const props = { field, visible: true, onEdit: vi.fn(), onRename: vi.fn().mockResolvedValue(undefined), onDelete: vi.fn(), onViewMove: vi.fn(), onVisibilityChange: vi.fn(), onDragStart: vi.fn(), onDragOver: vi.fn(), onDrop: vi.fn(), ...overrides }; return { props, ...render(<FieldEditor {...props} />) }; }
describe("FieldEditor", () => {
  it("字段列表行只提供可见性、编辑和独立删除入口", async () => { const user = userEvent.setup(); const { props } = renderRow(); expect(screen.queryByRole("button", { name: /更多/ })).toBeNull(); await user.click(screen.getByRole("button", { name: "编辑字段 状态" })); expect(props.onEdit).toHaveBeenCalledWith(field); await user.click(screen.getByRole("button", { name: "删除字段 状态" })); expect(props.onDelete).toHaveBeenCalledOnce(); });
  it("主标题始终可见且不提供删除入口", () => { renderRow({ field: { ...field, name: "标题", isTitle: true } }); expect(screen.getByRole("button", { name: "主标题始终显示" })).toBeDisabled(); expect(screen.queryByRole("button", { name: "删除字段 标题" })).toBeNull(); });
  it("点击字段名后可在列表中直接重命名", async () => { const user = userEvent.setup(); const { props } = renderRow(); await user.click(screen.getByRole("button", { name: "状态" })); const input = screen.getByRole("textbox", { name: "重命名字段 状态" }); await user.clear(input); await user.type(input, "进度"); await user.keyboard("{Enter}"); expect(props.onRename).toHaveBeenCalledWith(field, "进度"); });
});

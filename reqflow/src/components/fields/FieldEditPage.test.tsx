import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FieldSummary } from "../../types/domain";
import { FieldEditPage } from "./FieldEditPage";
const field: FieldSummary = { id: "estimate", tableId: "table", groupId: null, name: "估算", fieldType: "number", isTitle: false, position: 1, config: { format: "number" }, options: [] };
function renderPage(onSave = vi.fn().mockResolvedValue(true)) { return { onSave, ...render(<FieldEditPage field={field} error={null} onBack={vi.fn()} onSave={onSave} />) }; }
describe("FieldEditPage", () => {
  it("编辑格式只写入本地草稿，点击保存才提交", async () => { const user = userEvent.setup(); const { onSave } = renderPage(); await user.click(screen.getByRole("button", { name: "数字格式" })); await user.click(screen.getByRole("option", { name: "货币" })); expect(onSave).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "保存" })).toBeEnabled(); await user.click(screen.getByRole("button", { name: "保存" })); expect(onSave).toHaveBeenCalledWith(field, { fieldType: "number", config: { format: "currency" }, options: [] }); });
  it("取消不提交草稿", async () => { const user = userEvent.setup(); const { onSave } = renderPage(); await user.click(screen.getByRole("button", { name: "数字格式" })); await user.click(screen.getByRole("option", { name: "货币" })); await user.click(screen.getByRole("button", { name: "取消" })); expect(onSave).not.toHaveBeenCalled(); });
  it("字段类型和格式菜单在焦点或点击离开后收起", async () => { const user = userEvent.setup(); renderPage(); await user.click(screen.getByRole("button", { name: "数字格式" })); expect(screen.getByRole("listbox", { name: "数字格式" })).toBeInTheDocument(); fireEvent.pointerDown(document.body); expect(screen.queryByRole("listbox", { name: "数字格式" })).toBeNull(); await user.click(screen.getByRole("button", { name: "字段类型" })); expect(screen.getByRole("listbox", { name: "字段类型" })).toBeInTheDocument(); fireEvent.focusIn(document.body); expect(screen.queryByRole("listbox", { name: "字段类型" })).toBeNull(); });
});

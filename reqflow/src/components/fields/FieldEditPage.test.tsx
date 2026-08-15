import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FieldSummary } from "../../types/domain";
import { FieldEditPage } from "./FieldEditPage";
const field: FieldSummary = { id: "estimate", tableId: "table", groupId: null, name: "估算", fieldType: "number", isTitle: false, position: 1, config: { format: "number" }, options: [] };
function renderPage(onSave = vi.fn().mockResolvedValue(true)) { return { onSave, ...render(<FieldEditPage field={field} error={null} onBack={vi.fn()} onSave={onSave} />) }; }
describe("FieldEditPage", () => {
  it("编辑格式只写入本地草稿，点击保存才提交", async () => { const user = userEvent.setup(); const { onSave } = renderPage(); await user.click(screen.getByRole("button", { name: "数字格式" })); await user.click(screen.getByRole("option", { name: "货币" })); expect(onSave).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "保存" })).toBeEnabled(); await user.click(screen.getByRole("button", { name: "保存" })); expect(onSave).toHaveBeenCalledWith(field, { fieldType: "number", config: { format: "currency" }, options: [] }); });
  it("取消不提交草稿", async () => { const user = userEvent.setup(); const { onSave } = renderPage(); await user.click(screen.getByRole("button", { name: "数字格式" })); await user.click(screen.getByRole("option", { name: "货币" })); await user.click(screen.getByRole("button", { name: "取消" })); expect(onSave).not.toHaveBeenCalled(); });
});

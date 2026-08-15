import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TableHeader } from "./TableHeader";

const table = { id: "table", projectId: "project", name: "事项", emoji: "📋", position: 0, recordCount: 3, titleFieldId: "title", views: [] };

describe("TableHeader", () => {
  it("字段管理触发器暴露浮层 ARIA 状态与明确激活态", async () => {
    const user = userEvent.setup(); const onToggleFieldManager = vi.fn();
    render(<TableHeader table={table} onRename={vi.fn()} fieldManagerOpen onToggleFieldManager={onToggleFieldManager} />);
    const trigger = screen.getByRole("button", { name: "字段管理" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", "field-manager-popover");
    expect(trigger.className).toContain("bg-(--module-scope-action-subtle)");
    await user.click(trigger);
    expect(onToggleFieldManager).toHaveBeenCalledOnce();
  });
});

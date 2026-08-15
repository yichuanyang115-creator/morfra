import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FieldSummary } from "../../types/domain";
import { FieldEditPage } from "./FieldEditPage";

const field: FieldSummary = { id: "estimate", tableId: "table", groupId: null, name: "估算", fieldType: "number", isTitle: false, position: 1, config: { format: "number" }, options: [] };

function renderPage(overrides: Partial<Parameters<typeof FieldEditPage>[0]> = {}) {
  const props = { field, error: null, onBack: vi.fn(), onSave: vi.fn().mockResolvedValue(true), onCreateOption: vi.fn(), onUpdateOption: vi.fn(), onDeleteOption: vi.fn(), onReorderOption: vi.fn(), ...overrides };
  return { props, ...render(<FieldEditPage {...props} />) };
}

describe("FieldEditPage", () => {
  it("变更类型专属设置时立即写入且不显示取消或保存", async () => {
    const user = userEvent.setup(); const { props } = renderPage();
    expect(screen.queryByRole("button", { name: "取消" })).toBeNull();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
    await user.selectOptions(screen.getByLabelText("数字格式"), "currency");
    expect(props.onSave).toHaveBeenCalledWith(field, "number", { format: "currency" });
  });

  it("写入失败时恢复控件已保存值", async () => {
    const user = userEvent.setup(); renderPage({ onSave: vi.fn().mockResolvedValue(false) });
    await user.selectOptions(screen.getByLabelText("数字格式"), "currency");
    expect(screen.getByLabelText("数字格式")).toHaveValue("number");
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FieldTypePicker } from "./FieldTypePicker";

describe("FieldTypePicker", () => {
  it("选择类型后立即使用中文默认名称创建一次", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<FieldTypePicker onCreate={onCreate} onClose={vi.fn()} />);
    expect(document.querySelector('[data-field-type-icon="date"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "日期" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("date", "日期"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("创建失败时保留选择器并显示错误", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("写入失败"));
    render(<FieldTypePicker onCreate={onCreate} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("option", { name: "文本" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("写入失败");
    expect(screen.getByRole("dialog", { name: "选择字段类型" })).toBeTruthy();
  });
});

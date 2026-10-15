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

  it("焦点离开选择器时收起，焦点在内部移动时保持打开", () => {
    const onClose = vi.fn();
    render(<><FieldTypePicker onCreate={vi.fn().mockResolvedValue(undefined)} onClose={onClose} /><button type="button">外部操作</button></>);
    const dialog = screen.getByRole("dialog", { name: "选择字段类型" });
    const internalOption = screen.getByRole("option", { name: "文本" });

    fireEvent.blur(dialog, { relatedTarget: internalOption });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.blur(dialog, { relatedTarget: screen.getByRole("button", { name: "外部操作" }) });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("点击选择器外部时收起", () => {
    const onClose = vi.fn();
    render(<><FieldTypePicker onCreate={vi.fn().mockResolvedValue(undefined)} onClose={onClose} /><button type="button">外部操作</button></>);

    fireEvent.pointerDown(screen.getByRole("button", { name: "外部操作" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

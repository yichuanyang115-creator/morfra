import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toast } from "./Toast";

describe("Toast", () => {
  it("使用白底和左侧语义细条，并提供符号非颜色信号", () => {
    render(<Toast message="保存失败" tone="danger" onDismiss={vi.fn()} />);

    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("theme-module-feedback", "bg-(--surface)", "border-l-(--st-blocked)");
    expect(toast).toHaveTextContent("!");
    expect(toast).toHaveTextContent("保存失败");
  });
});

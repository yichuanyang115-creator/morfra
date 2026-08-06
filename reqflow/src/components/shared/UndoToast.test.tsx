import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UndoToast } from "./UndoToast";

describe("UndoToast", () => {
  afterEach(() => vi.useRealTimers());

  it("显示撤销摘要，并在 2.5 秒后自动关闭", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<UndoToast summary="修改属性" onDismiss={onDismiss} />);

    expect(screen.getByText("已撤销：修改属性")).toBeInTheDocument();
    vi.advanceTimersByTime(2499);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

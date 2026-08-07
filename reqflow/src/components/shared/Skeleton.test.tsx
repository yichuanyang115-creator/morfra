import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("加载区域使用暖白反馈模块背景和浅紫骨架条", () => {
    const { container } = render(<Skeleton />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("theme-module-feedback", "bg-(--module-scope-background-canvas)");
    expect(root.querySelector('[class*="bg-(--module-scope-background-elevated)"]')).not.toBeNull();
  });
});

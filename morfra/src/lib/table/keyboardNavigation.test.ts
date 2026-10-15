import { describe, expect, it } from "vitest";
import { directionForKey, isPrintableKey, moveSelection } from "./keyboardNavigation";
import { singleCell } from "./selectionModel";

describe("keyboardNavigation", () => {
  it("选中态遵守方向键、Tab 和边界停止", () => {
    const origin = singleCell({ row: 0, column: 0 });
    expect(moveSelection(origin, "left", 2, 2)).toEqual(origin);
    expect(moveSelection(origin, "right", 2, 2).active).toEqual({ row: 0, column: 1 });
    expect(directionForKey("Tab", true, false)).toBe("left");
  });

  it("编辑态 Return 按 Shift 决定垂直提交方向", () => {
    expect(directionForKey("Enter", false, true)).toBe("down");
    expect(directionForKey("Enter", true, true)).toBe("up");
  });

  it("只将无组合键的可打印字符视为替换编辑入口", () => {
    expect(isPrintableKey({ key: "a", metaKey: false, ctrlKey: false, altKey: false })).toBe(true);
    expect(isPrintableKey({ key: "a", metaKey: true, ctrlKey: false, altKey: false })).toBe(false);
  });
});

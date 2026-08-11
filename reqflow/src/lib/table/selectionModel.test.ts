import { describe, expect, it } from "vitest";
import { clampPoint, containsCell, extendRange, selectRows, singleCell } from "./selectionModel";

describe("selectionModel", () => {
  it("用活动格锚点扩展连续矩形区域", () => {
    const selection = extendRange(singleCell({ row: 2, column: 1 }), { row: 4, column: 3 });
    expect(containsCell(selection, { row: 3, column: 2 })).toBe(true);
    expect(containsCell(selection, { row: 1, column: 2 })).toBe(false);
    expect(selection.active).toEqual({ row: 4, column: 3 });
  });

  it("行号支持连续范围与 Command 非连续增减", () => {
    const first = selectRows(null, 2, "single");
    expect(selectRows(first, 4, "range").rows).toEqual([2, 3, 4]);
    expect(selectRows(first, 5, "toggle").rows).toEqual([2, 5]);
    const removedActiveRow = selectRows(selectRows(first, 5, "toggle"), 2, "toggle");
    expect(removedActiveRow.rows).toEqual([5]);
    expect(removedActiveRow.active.row).toBe(5);
  });

  it("向上连续拖拽行号时始终保留最初按下的锚点", () => {
    const started = selectRows(null, 5, "single");
    const overFour = selectRows(started, 4, "range");
    const overThree = selectRows(overFour, 3, "range");
    const overTwo = selectRows(overThree, 2, "range");

    expect(overFour.rows).toEqual([4, 5]);
    expect(overThree.rows).toEqual([3, 4, 5]);
    expect(overTwo.rows).toEqual([2, 3, 4, 5]);
    expect(overTwo.range.anchor.row).toBe(5);
  });

  it("导航落在边界时停止，不循环也不生成新坐标", () => {
    expect(clampPoint({ row: -1, column: 9 }, 3, 4)).toEqual({ row: 0, column: 3 });
  });
});

import { describe, expect, it } from "vitest";
import { GRID_OVERSCAN, visibleRange } from "./virtualGrid";

describe("virtualGrid", () => {
  it("10,000 行与 200 列基准只请求可见区及有限 overscan", () => {
    const rows = visibleRange(4_000, 640, 40, 10_000);
    const columns = visibleRange(1_600, 900, 200, 200);
    expect(rows.end - rows.start).toBeLessThanOrEqual(Math.ceil(640 / 40) + GRID_OVERSCAN * 2 + 1);
    expect(columns.end - columns.start).toBeLessThanOrEqual(Math.ceil(900 / 200) + GRID_OVERSCAN * 2 + 1);
    expect((rows.end - rows.start) * (columns.end - columns.start)).toBeLessThan(400);
  });
});

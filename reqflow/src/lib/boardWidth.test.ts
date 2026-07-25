import { describe, expect, it } from "vitest";
import { BOARD_DEFAULT_WIDTH, BOARD_MIN_WIDTH, DETAIL_MIN_WIDTH, RESIZER_WIDTH, clampBoardWidth } from "./boardWidth";

describe("clampBoardWidth", () => {
  it("视口足够宽时，落在上下限之间的宽度原样返回", () => {
    expect(clampBoardWidth(BOARD_DEFAULT_WIDTH - 100, 1600)).toBe(BOARD_DEFAULT_WIDTH - 100);
  });

  it("拖到比最小宽度还窄时，夹到 BOARD_MIN_WIDTH", () => {
    expect(clampBoardWidth(100, 1600)).toBe(BOARD_MIN_WIDTH);
  });

  it("视口很宽、余量远超内容实际能用的最大宽度时，上限封顶在 BOARD_DEFAULT_WIDTH，不会拖出看板内容之外的空白", () => {
    const viewport = 1600;
    expect(clampBoardWidth(2000, viewport)).toBe(BOARD_DEFAULT_WIDTH);
  });

  it("视口收紧到详情面板快被挤没时，上限收窄到 视口宽度 - 分隔条 - 详情面板最小宽度，让看板给详情面板让路", () => {
    const viewport = 1100;
    const expectedMax = viewport - RESIZER_WIDTH - DETAIL_MIN_WIDTH;
    expect(expectedMax).toBeGreaterThan(BOARD_MIN_WIDTH);
    expect(expectedMax).toBeLessThan(BOARD_DEFAULT_WIDTH);
    expect(clampBoardWidth(2000, viewport)).toBe(expectedMax);
  });

  it("视口窄到连最小宽度都放不下详情面板时，上限退让到 BOARD_MIN_WIDTH，不会比下限更小", () => {
    const viewport = 700;
    expect(clampBoardWidth(BOARD_DEFAULT_WIDTH, viewport)).toBe(BOARD_MIN_WIDTH);
  });
});

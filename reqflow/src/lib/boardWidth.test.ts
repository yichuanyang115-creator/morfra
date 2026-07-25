import { describe, expect, it } from "vitest";
import {
  BOARD_DEFAULT_WIDTH,
  BOARD_MIN_WIDTH,
  CHAT_MIN_VISIBLE_WIDTH,
  CHAT_MIN_WIDTH,
  DETAIL_CONTENT_MAX_WIDTH,
  DETAIL_MIN_WIDTH,
  RESIZER_WIDTH,
  chatPanelWidth,
  clampBoardWidth,
} from "./boardWidth";

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

describe("chatPanelWidth（REQ-024 详情面板对话框宽度）", () => {
  it("剩余空间刚好等于 CHAT_MIN_VISIBLE_WIDTH 时显示，宽度等于剩余空间", () => {
    const detailPanelWidth = DETAIL_CONTENT_MAX_WIDTH + CHAT_MIN_VISIBLE_WIDTH;
    expect(chatPanelWidth(detailPanelWidth)).toBe(CHAT_MIN_VISIBLE_WIDTH);
  });

  it("剩余空间比 CHAT_MIN_VISIBLE_WIDTH 少 1px 时不显示，返回 null", () => {
    const detailPanelWidth = DETAIL_CONTENT_MAX_WIDTH + CHAT_MIN_VISIBLE_WIDTH - 1;
    expect(chatPanelWidth(detailPanelWidth)).toBeNull();
  });

  it("面板宽度小于内容限宽（剩余空间为负）时不显示，返回 null", () => {
    expect(chatPanelWidth(DETAIL_CONTENT_MAX_WIDTH - 100)).toBeNull();
  });

  it("剩余空间充足时，对话框宽度等于剩余空间（跟随面板宽度变化）", () => {
    const detailPanelWidth = DETAIL_CONTENT_MAX_WIDTH + 400;
    expect(chatPanelWidth(detailPanelWidth)).toBe(400);
  });

  it("剩余空间远超时也不封顶——对话框和看板不同，没有内容自身的最大宽度限制", () => {
    const detailPanelWidth = DETAIL_CONTENT_MAX_WIDTH + 2000;
    expect(chatPanelWidth(detailPanelWidth)).toBe(2000);
  });

  it("剩余空间在 [CHAT_MIN_VISIBLE_WIDTH, CHAT_MIN_WIDTH) 之间时不会出现（CHAT_MIN_VISIBLE_WIDTH 本身应 ≥ CHAT_MIN_WIDTH，防御性下夹验证）", () => {
    expect(CHAT_MIN_VISIBLE_WIDTH).toBeGreaterThanOrEqual(CHAT_MIN_WIDTH);
  });
});

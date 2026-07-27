import { describe, expect, it } from "vitest";
import {
  BOARD_DEFAULT_WIDTH,
  BOARD_MIN_WIDTH,
  CHAT_MIN_WIDTH,
  DETAIL_MIN_WIDTH,
  RESIZER_WIDTH,
  chatMaxWidth,
  chatOccupiedWidth,
  clampBoardWidth,
  clampChatWidth,
  detailPanelWidthFor,
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

  it("视口收紧到详情面板快被挤没时，上限收窄到 视口宽度 - 分隔条 - 详情面板底线，让看板给详情面板让路", () => {
    const viewport = 1200;
    const expectedMax = viewport - RESIZER_WIDTH - DETAIL_MIN_WIDTH;
    expect(expectedMax).toBeGreaterThan(BOARD_MIN_WIDTH);
    expect(expectedMax).toBeLessThan(BOARD_DEFAULT_WIDTH);
    expect(clampBoardWidth(2000, viewport)).toBe(expectedMax);
  });

  it("视口窄到连底线都放不下详情面板时，上限退让到 BOARD_MIN_WIDTH，不会比下限更小", () => {
    const viewport = 700;
    expect(clampBoardWidth(BOARD_DEFAULT_WIDTH, viewport)).toBe(BOARD_MIN_WIDTH);
  });

  it("看板拖拽上限不受对话框是否打开影响——保护详情面板底线是对话框拖拽上限的职责，不是看板的", () => {
    const viewport = 1200;
    expect(clampBoardWidth(2000, viewport)).toBe(viewport - RESIZER_WIDTH - DETAIL_MIN_WIDTH);
  });
});

describe("chatMaxWidth", () => {
  it("expanded 态：上限 = 视口 - 看板占用(含分隔条) - 详情底线480 - 自己的分隔条", () => {
    const viewport = 1600;
    const board = BOARD_DEFAULT_WIDTH;
    const expected = viewport - (clampBoardWidth(board, viewport) + RESIZER_WIDTH) - DETAIL_MIN_WIDTH - RESIZER_WIDTH;
    expect(chatMaxWidth("expanded", board, viewport)).toBe(expected);
  });

  it("collapsed 态：详情面板本就是 0 宽度，没有 480 底线要保，看板也不占列，上限只减自己的分隔条", () => {
    const viewport = 1600;
    expect(chatMaxWidth("collapsed", BOARD_DEFAULT_WIDTH, viewport)).toBe(viewport - RESIZER_WIDTH);
  });

  it("fullscreen 态：看板不显示，只保留详情底线和自己的分隔条", () => {
    const viewport = 1600;
    expect(chatMaxWidth("fullscreen", BOARD_DEFAULT_WIDTH, viewport)).toBe(viewport - DETAIL_MIN_WIDTH - RESIZER_WIDTH);
  });

  it("视口窄到算出的上限会低于 CHAT_MIN_WIDTH 时，夹到 CHAT_MIN_WIDTH（不会出现上限小于下限）", () => {
    const viewport = 1024;
    const max = chatMaxWidth("expanded", BOARD_DEFAULT_WIDTH, viewport);
    expect(max).toBeGreaterThanOrEqual(CHAT_MIN_WIDTH);
  });
});

describe("clampChatWidth", () => {
  it("落在范围内的宽度原样返回", () => {
    const viewport = 2000;
    expect(clampChatWidth(400, "expanded", BOARD_DEFAULT_WIDTH, viewport)).toBe(400);
  });

  it("拖到比 240 还窄时夹到 CHAT_MIN_WIDTH", () => {
    const viewport = 2000;
    expect(clampChatWidth(100, "expanded", BOARD_DEFAULT_WIDTH, viewport)).toBe(CHAT_MIN_WIDTH);
  });

  it("拖宽超过上限时夹到 chatMaxWidth，此时详情面板恰好保持在 480px 底线", () => {
    const viewport = 1600;
    const board = BOARD_DEFAULT_WIDTH;
    const max = chatMaxWidth("expanded", board, viewport);
    const clamped = clampChatWidth(5000, "expanded", board, viewport);
    expect(clamped).toBe(max);
    const occupied = chatOccupiedWidth(true, clamped, "expanded", board, viewport);
    expect(detailPanelWidthFor("expanded", board, viewport, occupied)).toBe(DETAIL_MIN_WIDTH);
  });
});

describe("chatOccupiedWidth", () => {
  it("关闭时占用为 0", () => {
    expect(chatOccupiedWidth(false, 400, "expanded", BOARD_DEFAULT_WIDTH, 1600)).toBe(0);
  });

  it("打开时占用 = 夹紧后的宽度 + 自己的分隔条", () => {
    const viewport = 2000;
    const board = BOARD_DEFAULT_WIDTH;
    expect(chatOccupiedWidth(true, 400, "expanded", board, viewport)).toBe(400 + RESIZER_WIDTH);
  });
});

describe("detailPanelWidthFor", () => {
  it("collapsed 态返回 0，不管看板宽度、视口或对话框占用多大", () => {
    expect(detailPanelWidthFor("collapsed", BOARD_DEFAULT_WIDTH, 2000, 326)).toBe(0);
  });

  it("fullscreen 态返回 视口 - 对话框占用（看板不显示）", () => {
    expect(detailPanelWidthFor("fullscreen", BOARD_DEFAULT_WIDTH, 1200, 0)).toBe(1200);
    expect(detailPanelWidthFor("fullscreen", BOARD_DEFAULT_WIDTH, 1200, 326)).toBe(1200 - 326);
  });

  it("expanded 态返回 视口 - 夹紧后的看板宽度 - 分隔条 - 对话框占用", () => {
    const viewport = 1600;
    const clamped = clampBoardWidth(BOARD_DEFAULT_WIDTH, viewport);
    expect(detailPanelWidthFor("expanded", BOARD_DEFAULT_WIDTH, viewport, 0)).toBe(viewport - clamped - RESIZER_WIDTH);
    expect(detailPanelWidthFor("expanded", BOARD_DEFAULT_WIDTH, viewport, 326)).toBe(
      viewport - clamped - RESIZER_WIDTH - 326,
    );
  });
});

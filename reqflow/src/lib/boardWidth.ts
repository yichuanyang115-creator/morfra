/**
 * 看板列宽度上下限（数值来源：需求管理系统原型.html 内 boardWidthBounds 注释推导过程，
 * 已验证方案A"拖详情面板宽度、看板被动吃剩余空间"是结构性问题，改用方案B"看板受拖拽
 * 控制、详情面板占满剩余空间"）。
 */
export const BOARD_MIN_WIDTH = 641;
export const BOARD_DEFAULT_WIDTH = 821;
export const DETAIL_MIN_WIDTH = 360;
export const RESIZER_WIDTH = 6;

/** 详情面板正文内容限宽（REQ-003），须与 tokens.css 的 --detail-max-w 保持一致。 */
export const DETAIL_CONTENT_MAX_WIDTH = 660;
/** 对话框显示所需的最小剩余空间，同时也是显示时的最小宽度（REQ-024 v2.7：手动开关取代自动
 * 显隐后，"能不能显示"和"显示多宽"用的是同一个阈值，不再需要两个独立常量）。 */
export const CHAT_MIN_WIDTH = 240;

/**
 * 看板行内容本身有上限（名称列封顶 320px + 其余数据列，见 --board-row-max-w），
 * 拖到 BOARD_DEFAULT_WIDTH 内容就已经完全展开贴满，继续往右拖只会露出没有意义
 * 的空白——所以拖拽上限直接封顶在 BOARD_DEFAULT_WIDTH，不再用视口宽度倒推。
 * 视口仍然影响下限侧：窗口缩小时如果详情面板会被挤到小于 DETAIL_MIN_WIDTH，
 * 上限相应收紧（收窄看板给详情面板让路），但不会超过 BOARD_DEFAULT_WIDTH。
 */
export function clampBoardWidth(width: number, viewportWidth: number): number {
  const viewportMax = Math.max(BOARD_MIN_WIDTH, viewportWidth - RESIZER_WIDTH - DETAIL_MIN_WIDTH);
  const max = Math.min(BOARD_DEFAULT_WIDTH, viewportMax);
  return Math.max(BOARD_MIN_WIDTH, Math.min(max, width));
}

export type DetailLayoutMode = "expanded" | "collapsed" | "fullscreen";

/**
 * 详情面板的实际像素宽度：expanded 态 = 视口 - 看板 - 分隔条；fullscreen 态占满视口；
 * collapsed 态为 0。跟 Topbar 的对话框开关（判断是否有空间可用）和 MainLayout 的对话框
 * 渲染共用同一份计算，避免两处各写一份、以后跑偏。
 */
export function detailPanelWidthFor(
  detailMode: DetailLayoutMode,
  boardWidth: number,
  viewportWidth: number,
): number {
  if (detailMode === "collapsed") return 0;
  if (detailMode === "fullscreen") return viewportWidth;
  return viewportWidth - clampBoardWidth(boardWidth, viewportWidth) - RESIZER_WIDTH;
}

/**
 * 对话框宽度 = 详情面板实际宽度 - 正文内容限宽后的剩余空间（REQ-024）。
 * 剩余空间不足 CHAT_MIN_WIDTH 时返回 null（不可用：不显示，顶栏开关置灰）。
 */
export function chatPanelWidth(detailPanelWidth: number): number | null {
  const remaining = detailPanelWidth - DETAIL_CONTENT_MAX_WIDTH;
  if (remaining < CHAT_MIN_WIDTH) return null;
  return remaining;
}

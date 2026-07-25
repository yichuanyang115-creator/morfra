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
/** 对话框可见所需的最小剩余空间，低于此不显示（REQ-024）。 */
export const CHAT_MIN_VISIBLE_WIDTH = 280;
/** 对话框显示时的最小宽度（REQ-024）。 */
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

/**
 * 对话框宽度 = 详情面板实际宽度 - 正文内容限宽后的剩余空间（REQ-024）。
 * 剩余空间不足 CHAT_MIN_VISIBLE_WIDTH 时返回 null（不显示，不占位）；
 * 否则夹到不小于 CHAT_MIN_WIDTH（剩余空间本身已经 ≥ CHAT_MIN_VISIBLE_WIDTH > CHAT_MIN_WIDTH，
 * 这里的下夹是防御性写法，正常路径不会触发）。
 */
export function chatPanelWidth(detailPanelWidth: number): number | null {
  const remaining = detailPanelWidth - DETAIL_CONTENT_MAX_WIDTH;
  if (remaining < CHAT_MIN_VISIBLE_WIDTH) return null;
  return Math.max(CHAT_MIN_WIDTH, remaining);
}

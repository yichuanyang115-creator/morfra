/**
 * 看板列宽度上下限（数值来源：需求管理系统原型.html 内 boardWidthBounds 注释推导过程，
 * 已验证方案A"拖详情面板宽度、看板被动吃剩余空间"是结构性问题，改用方案B"看板受拖拽
 * 控制、详情面板占满剩余空间"）。
 */
export const BOARD_MIN_WIDTH = 641;
export const BOARD_DEFAULT_WIDTH = 821;
export const DETAIL_MIN_WIDTH = 360;
export const RESIZER_WIDTH = 6;

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

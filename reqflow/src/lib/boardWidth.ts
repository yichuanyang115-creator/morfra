/**
 * 看板列宽度上下限（数值来源：需求管理系统原型.html 内 boardWidthBounds 注释推导过程，
 * 已验证方案A"拖详情面板宽度、看板被动吃剩余空间"是结构性问题，改用方案B"看板受拖拽
 * 控制、详情面板占满剩余空间"）。
 */
export const BOARD_MIN_WIDTH = 641;
export const BOARD_DEFAULT_WIDTH = 821;
/** 详情面板自适应收缩底线（REQ-003 v2.8），低于此改为限制对话框继续拖宽，看板拖拽不受此约束。 */
export const DETAIL_MIN_WIDTH = 480;
export const RESIZER_WIDTH = 6;

/** 对话框独立拖拽范围（REQ-024 v2.8）：下限固定，默认宽度打开时首次使用。 */
export const CHAT_MIN_WIDTH = 240;
export const CHAT_DEFAULT_WIDTH = 320;

export type DetailLayoutMode = "expanded" | "collapsed" | "fullscreen";

/**
 * 看板行内容本身有上限（名称列封顶 320px + 其余数据列，见 --board-row-max-w），
 * 拖到 BOARD_DEFAULT_WIDTH 内容就已经完全展开贴满，继续往右拖只会露出没有意义
 * 的空白——所以拖拽上限直接封顶在 BOARD_DEFAULT_WIDTH，不再用视口宽度倒推。
 * 视口仍然影响下限侧：窗口缩小时如果详情面板会被挤到小于 DETAIL_MIN_WIDTH，
 * 上限相应收紧（收窄看板给详情面板让路），但不会超过 BOARD_DEFAULT_WIDTH。
 * 看板拖拽本身独立于对话框是否打开（REQ-003 v2.8：保护详情面板 480px 底线的
 * 责任在对话框拖拽上限侧，见 chatMaxWidth，不在这里）。
 */
export function clampBoardWidth(width: number, viewportWidth: number): number {
  const viewportMax = Math.max(BOARD_MIN_WIDTH, viewportWidth - RESIZER_WIDTH - DETAIL_MIN_WIDTH);
  const max = Math.min(BOARD_DEFAULT_WIDTH, viewportMax);
  return Math.max(BOARD_MIN_WIDTH, Math.min(max, width));
}

/**
 * 对话框拖拽上限（REQ-024 v2.8）：视口宽度减去看板占用（含自己的分隔条）、详情面板
 * 底线 480px、对话框自己的分隔条。collapsed 态详情面板本就是 0 宽度、没有 480px 底线
 * 要保，看板也不占独立列（并入主内容区撑满剩余空间）；fullscreen 态看板不显示，
 * 只保留详情底线。用的是看板"当前实际宽度"（已夹过），不是拖拽中的原始值，避免和
 * clampBoardWidth 形成循环依赖——看板拖拽不读对话框状态，对话框拖拽读看板结果，
 * 单向依赖。
 */
export function chatMaxWidth(detailMode: DetailLayoutMode, boardWidth: number, viewportWidth: number): number {
  const detailFloor = detailMode === "collapsed" ? 0 : DETAIL_MIN_WIDTH;
  const boardOccupied = detailMode === "expanded" ? clampBoardWidth(boardWidth, viewportWidth) + RESIZER_WIDTH : 0;
  const reserved = boardOccupied + detailFloor + RESIZER_WIDTH;
  return Math.max(CHAT_MIN_WIDTH, viewportWidth - reserved);
}

/** 把对话框宽度夹到 [CHAT_MIN_WIDTH, chatMaxWidth(...)] 区间内。 */
export function clampChatWidth(
  width: number,
  detailMode: DetailLayoutMode,
  boardWidth: number,
  viewportWidth: number,
): number {
  const max = chatMaxWidth(detailMode, boardWidth, viewportWidth);
  return Math.max(CHAT_MIN_WIDTH, Math.min(max, width));
}

/**
 * 对话框当前占用的像素（含它自己的分隔条），关闭时为 0。传入详情面板宽度计算时
 * 统一用这个值，和 Topbar 判断是否有历史宽度需要重新夹紧共用同一份计算。
 */
export function chatOccupiedWidth(
  open: boolean,
  chatWidth: number,
  detailMode: DetailLayoutMode,
  boardWidth: number,
  viewportWidth: number,
): number {
  if (!open) return 0;
  return RESIZER_WIDTH + clampChatWidth(chatWidth, detailMode, boardWidth, viewportWidth);
}

/**
 * 详情面板的实际像素宽度：expanded 态 = 视口 - 看板(含分隔条) - 对话框占用；
 * fullscreen 态 = 视口 - 对话框占用（看板不显示）；collapsed 态为 0。
 * chatOccupied 由 chatOccupiedWidth 算出后传入。
 */
export function detailPanelWidthFor(
  detailMode: DetailLayoutMode,
  boardWidth: number,
  viewportWidth: number,
  chatOccupied: number,
): number {
  if (detailMode === "collapsed") return 0;
  if (detailMode === "fullscreen") return viewportWidth - chatOccupied;
  return viewportWidth - clampBoardWidth(boardWidth, viewportWidth) - RESIZER_WIDTH - chatOccupied;
}

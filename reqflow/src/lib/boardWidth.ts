import type { Attribute, AttributeType } from "../types/schema";

/** Name 列固定宽度区间（唯一强制冻结的列，见 REQ-001 MUST 下限 140px）。 */
export const NAME_COLUMN_MIN_WIDTH = 140;
const NAME_COLUMN_TEMPLATE = "minmax(140px, 320px)";

/**
 * 冻结列之外至少留出的最小滚动区宽度，保证面板拖到最窄时除了 Name 列还能看见
 * 一部分属性列，不是"只剩名称、其余全部裁没"。本 Phase 只有 Name 列冻结，
 * Phase 19 支持多列冻结后 BOARD_MIN_WIDTH 的冻结列宽总和部分需跟着累加。
 */
const MIN_SCROLL_AREA_WIDTH = 200;

/**
 * 看板面板拖拽下限（Phase 16 起：冻结列宽总和 + 最小滚动区，取代原来"整行 8 列
 * 内容一次性塞进面板"的写死值。看板区域现在靠横向滚动承载动态列数，面板本身
 * 不再需要宽到能塞下所有列）。
 */
export const BOARD_MIN_WIDTH = NAME_COLUMN_MIN_WIDTH + MIN_SCROLL_AREA_WIDTH;
export const BOARD_DEFAULT_WIDTH = 821;
/**
 * 详情面板自适应收缩底线（REQ-003 v2.8），低于此改为限制对话框继续拖宽，看板拖拽
 * 不受此约束。改这个值时要同步检查 tauri.conf.json 的 app.windows[0].minWidth——
 * 应用允许缩到的最小窗口宽度必须 ≥ BOARD_MIN_WIDTH + RESIZER_WIDTH + DETAIL_MIN_WIDTH，
 * 否则窗口能被缩到详情面板挤破底线都保不住的宽度（当前 340+6+480=826，tauri.conf.json
 * 的 minWidth=1127 满足此不变式）。
 */
export const DETAIL_MIN_WIDTH = 480;
export const RESIZER_WIDTH = 6;

/** 对话框独立拖拽范围（REQ-024 v2.8）：下限固定，默认宽度打开时首次使用。 */
export const CHAT_MIN_WIDTH = 240;
export const CHAT_DEFAULT_WIDTH = 320;

export type DetailLayoutMode = "expanded" | "closed" | "fullscreen";

/**
 * 看板面板宽度拖到 BOARD_DEFAULT_WIDTH 时，Phase 15 之前固定 8 列的内容已经
 * 完全展开贴满，继续往右拖只会露出没有意义的空白——这条历史上限延续下来，
 * 拖拽上限直接封顶在 BOARD_DEFAULT_WIDTH，不再用视口宽度倒推。看板区域内部
 * 现在靠横向滚动（见 gridTemplateColumnsFor）承载可能超出面板宽度的动态列数，
 * 不再要求面板宽度本身容纳全部列。
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
 * 底线 480px、对话框自己的分隔条。closed 态详情面板本就是 0 宽度、没有 480px 底线
 * 要保，看板也不占独立列（并入主内容区撑满剩余空间）；fullscreen 态看板不显示，
 * 只保留详情底线。用的是看板"当前实际宽度"（已夹过），不是拖拽中的原始值，避免和
 * clampBoardWidth 形成循环依赖——看板拖拽不读对话框状态，对话框拖拽读看板结果，
 * 单向依赖。
 */
export function chatMaxWidth(detailMode: DetailLayoutMode, boardWidth: number, viewportWidth: number): number {
  const detailFloor = detailMode === "closed" ? 0 : DETAIL_MIN_WIDTH;
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
 * fullscreen 态 = 视口 - 对话框占用（看板不显示）；closed 态为 0。
 * chatOccupied 由 chatOccupiedWidth 算出后传入。
 */
export function detailPanelWidthFor(
  detailMode: DetailLayoutMode,
  boardWidth: number,
  viewportWidth: number,
  chatOccupied: number,
): number {
  if (detailMode === "closed") return 0;
  if (detailMode === "fullscreen") return viewportWidth - chatOccupied;
  return viewportWidth - clampBoardWidth(boardWidth, viewportWidth) - RESIZER_WIDTH - chatOccupied;
}

/**
 * 属性类型的默认列宽（px），延续 Phase 15 之前写死的 8 列宽度作为起点。
 * Phase 19 起用户可拖拽调宽并持久化到 schema.json viewPreferences，这里的值
 * 只是列宽从未被用户调整过时的初始值。
 */
const DEFAULT_COLUMN_WIDTH_BY_TYPE: Record<AttributeType, number> = {
  singleSelect: 56,
  multiSelect: 72,
  number: 56,
  percent: 40,
  date: 56,
  text: 56,
  checkbox: 40,
  attachment: 56,
  computed: 56,
};

function defaultColumnWidth(attribute: Attribute): number {
  return DEFAULT_COLUMN_WIDTH_BY_TYPE[attribute.type];
}

/**
 * 属性列的有效宽度：用户拖拽调宽后存在 viewPreferences.columnWidths 里的值优先，
 * 没调过就用类型默认宽度。下限夹到默认宽度（REQ-001 MUST"下限=各自默认宽度"），
 * 防止存量数据里出现意外写入的过小宽度。
 */
export function columnWidthFor(attribute: Attribute, columnWidths: Record<string, number>): number {
  const stored = columnWidths[attribute.id];
  const min = defaultColumnWidth(attribute);
  return stored !== undefined && Number.isFinite(stored) ? Math.max(min, stored) : min;
}

/**
 * 从看板可见属性列表生成 CSS grid-template-columns 字符串，Name 列固定最左
 * （REQ-001 MUST，不参与本函数的动态计算）。其余属性列宽度：用户拖拽调整过
 * 就用 columnWidths 里存的值（Phase 19 起持久化），没调过就用类型默认宽度。
 */
export function gridTemplateColumnsFor(attributes: Attribute[], columnWidths: Record<string, number> = {}): string {
  const columns = attributes.map((a) => `${columnWidthFor(a, columnWidths)}px`);
  return [NAME_COLUMN_TEMPLATE, ...columns].join(" ");
}

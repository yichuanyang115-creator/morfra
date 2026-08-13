export const MIN_WINDOW_WIDTH = 960;
export const MIN_WINDOW_HEIGHT = 640;
export const REGULAR_WINDOW_BREAKPOINT = 1200;
export const TITLEBAR_HEIGHT = 40;
export const SIDEBAR_COLLAPSED_WIDTH = 48;
export const SIDEBAR_COMPACT_MIN_WIDTH = 96;
export const SIDEBAR_FULL_MIN_WIDTH = 200;
export const SIDEBAR_DEFAULT_WIDTH = 240;
export const SIDEBAR_MAX_WIDTH = 360;
export const SIDEBAR_COLLAPSE_THRESHOLD = 56;
export const SIDEBAR_EXPAND_THRESHOLD = 72;
export const MAIN_MIN_WIDTH = 560;
export const DETAIL_MIN_WIDTH = 360;
export const DETAIL_DEFAULT_WIDTH = 440;
export const DETAIL_MAX_WIDTH = 720;
export const AI_MIN_WIDTH = 320;
export const AI_DEFAULT_WIDTH = 360;
export const AI_MAX_WIDTH = 560;
export const PANEL_RESIZER_WIDTH = 8;

export type WindowMode = "narrow" | "regular";
export type RightPanelMode = "none" | "single" | "dual" | "merged" | "drawer";

export interface WindowLayoutInput {
  viewportWidth: number;
  viewportHeight: number;
  sidebarOpen: boolean;
  sidebarWidth: number;
  detailOpen: boolean;
  detailWidth: number;
  aiOpen: boolean;
  aiWidth: number;
  activeRightPanel?: "detail" | "ai";
}

export interface WindowLayout {
  mode: WindowMode;
  sidebarMode: "expanded" | "compact" | "collapsed";
  sidebarWidth: number;
  rightPanelMode: RightPanelMode;
  rightPanelWidth: number;
  detailWidth: number;
  aiWidth: number;
  contentHeight: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function safeWidth(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function calculateWindowLayout(input: WindowLayoutInput): WindowLayout {
  const viewportWidth = Math.max(safeWidth(input.viewportWidth, MIN_WINDOW_WIDTH), MIN_WINDOW_WIDTH);
  const viewportHeight = Math.max(safeWidth(input.viewportHeight, MIN_WINDOW_HEIGHT), MIN_WINDOW_HEIGHT);
  const mode: WindowMode = viewportWidth < REGULAR_WINDOW_BREAKPOINT ? "narrow" : "regular";
  const detailWidth = clamp(safeWidth(input.detailWidth, DETAIL_DEFAULT_WIDTH), DETAIL_MIN_WIDTH, DETAIL_MAX_WIDTH);
  const aiWidth = clamp(safeWidth(input.aiWidth, AI_DEFAULT_WIDTH), AI_MIN_WIDTH, AI_MAX_WIDTH);
  const activePanel = input.activeRightPanel === "ai" ? "ai" : "detail";

  if (mode === "narrow") {
    const drawerWidth = clamp(Math.max(detailWidth, aiWidth), 320, viewportWidth - 32);
    return {
      mode,
      sidebarMode: "collapsed",
      sidebarWidth: SIDEBAR_COLLAPSED_WIDTH,
      rightPanelMode: input.detailOpen || input.aiOpen ? "drawer" : "none",
      rightPanelWidth: input.detailOpen || input.aiOpen ? drawerWidth : 0,
      detailWidth,
      aiWidth,
      contentHeight: viewportHeight - TITLEBAR_HEIGHT,
    };
  }

  const configuredSidebarWidth = input.sidebarOpen
    ? clamp(safeWidth(input.sidebarWidth, SIDEBAR_DEFAULT_WIDTH), SIDEBAR_COMPACT_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
    : SIDEBAR_COLLAPSED_WIDTH;
  const sidebarResizerWidth = input.sidebarOpen ? PANEL_RESIZER_WIDTH : 0;
  const bothOpen = input.detailOpen && input.aiOpen;
  const hasPanel = input.detailOpen || input.aiOpen;
  const minimumActivePanelWidth = input.detailOpen && (!input.aiOpen || activePanel === "detail") ? DETAIL_MIN_WIDTH : AI_MIN_WIDTH;
  const sidebarWidth = hasPanel && configuredSidebarWidth !== SIDEBAR_COLLAPSED_WIDTH
    ? Math.min(configuredSidebarWidth, Math.max(SIDEBAR_COMPACT_MIN_WIDTH, viewportWidth - MAIN_MIN_WIDTH - minimumActivePanelWidth - PANEL_RESIZER_WIDTH - sidebarResizerWidth))
    : configuredSidebarWidth;
  const availableDualPanelWidth = viewportWidth - sidebarWidth - MAIN_MIN_WIDTH - PANEL_RESIZER_WIDTH * 2 - sidebarResizerWidth;

  if (bothOpen && availableDualPanelWidth >= DETAIL_MIN_WIDTH + AI_MIN_WIDTH) {
    const renderedDetailWidth = Math.min(detailWidth, availableDualPanelWidth - AI_MIN_WIDTH);
    const renderedAiWidth = Math.min(aiWidth, availableDualPanelWidth - renderedDetailWidth);
    return {
      mode,
      sidebarMode: input.sidebarOpen ? sidebarWidth < SIDEBAR_FULL_MIN_WIDTH ? "compact" : "expanded" : "collapsed",
      sidebarWidth,
      rightPanelMode: "dual",
      rightPanelWidth: renderedDetailWidth + renderedAiWidth,
      detailWidth: renderedDetailWidth,
      aiWidth: renderedAiWidth,
      contentHeight: viewportHeight - TITLEBAR_HEIGHT,
    };
  }

  const activePanelWidth = input.detailOpen && (!input.aiOpen || activePanel === "detail") ? detailWidth : aiWidth;
  const availableSinglePanel = viewportWidth - sidebarWidth - MAIN_MIN_WIDTH - PANEL_RESIZER_WIDTH - sidebarResizerWidth;
  const fittedSinglePanelWidth = clamp(activePanelWidth, input.detailOpen ? DETAIL_MIN_WIDTH : AI_MIN_WIDTH, availableSinglePanel);

  return {
    mode,
    sidebarMode: input.sidebarOpen ? sidebarWidth < SIDEBAR_FULL_MIN_WIDTH ? "compact" : "expanded" : "collapsed",
    sidebarWidth,
    rightPanelMode: !hasPanel ? "none" : bothOpen ? "merged" : "single",
    rightPanelWidth: hasPanel ? fittedSinglePanelWidth : 0,
    detailWidth,
    aiWidth,
    contentHeight: viewportHeight - TITLEBAR_HEIGHT,
  };
}

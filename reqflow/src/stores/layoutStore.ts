import { create } from "zustand";
import {
  AI_DEFAULT_WIDTH,
  DETAIL_DEFAULT_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  AI_MAX_WIDTH,
  AI_MIN_WIDTH,
  DETAIL_MAX_WIDTH,
  DETAIL_MIN_WIDTH,
} from "../lib/layout/windowLayout";

export type AppearanceMode = "system" | "light" | "dark";
export type ActiveRightPanel = "detail" | "ai";

export interface LayoutPreferences {
  sidebarOpen: boolean;
  sidebarWidth: number;
  detailOpen: boolean;
  detailWidth: number;
  aiOpen: boolean;
  aiWidth: number;
  activeRightPanel: ActiveRightPanel;
  appearanceMode: AppearanceMode;
}

interface LayoutState extends LayoutPreferences {
  hydrated: boolean;
  hydrate: () => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleDetail: () => void;
  setDetailWidth: (width: number) => void;
  setAiOpen: (open: boolean) => void;
  toggleAi: () => void;
  setAiWidth: (width: number) => void;
  setActiveRightPanel: (panel: ActiveRightPanel) => void;
  setAppearanceMode: (mode: AppearanceMode) => void;
}

const STORAGE_KEY = "morfra.layout.preferences.v1";

export const DEFAULT_LAYOUT_PREFERENCES: LayoutPreferences = {
  sidebarOpen: true,
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  detailOpen: false,
  detailWidth: DETAIL_DEFAULT_WIDTH,
  aiOpen: false,
  aiWidth: AI_DEFAULT_WIDTH,
  activeRightPanel: "detail",
  appearanceMode: "system",
};

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "system" || value === "light" || value === "dark";
}

function readPreferences(): Partial<LayoutPreferences> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return value as Partial<LayoutPreferences>;
  } catch {
    return {};
  }
}

function persist(state: LayoutPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 偏好保存失败不阻断当前窗口操作；下一次启动回到安全默认值。
  }
}

function normalizePreferences(value: Partial<LayoutPreferences>): LayoutPreferences {
  return {
    sidebarOpen: value.sidebarOpen !== false,
    sidebarWidth: Number.isFinite(value.sidebarWidth) ? Math.min(Math.max(value.sidebarWidth as number, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH) : SIDEBAR_DEFAULT_WIDTH,
    detailOpen: value.detailOpen === true,
    detailWidth: Number.isFinite(value.detailWidth) ? Math.min(Math.max(value.detailWidth as number, DETAIL_MIN_WIDTH), DETAIL_MAX_WIDTH) : DETAIL_DEFAULT_WIDTH,
    aiOpen: value.aiOpen === true,
    aiWidth: Number.isFinite(value.aiWidth) ? Math.min(Math.max(value.aiWidth as number, AI_MIN_WIDTH), AI_MAX_WIDTH) : AI_DEFAULT_WIDTH,
    activeRightPanel: value.activeRightPanel === "ai" ? "ai" : "detail",
    appearanceMode: isAppearanceMode(value.appearanceMode) ? value.appearanceMode : "system",
  };
}

function currentPreferences(state: LayoutState): LayoutPreferences {
  return {
    sidebarOpen: state.sidebarOpen,
    sidebarWidth: state.sidebarWidth,
    detailOpen: state.detailOpen,
    detailWidth: state.detailWidth,
    aiOpen: state.aiOpen,
    aiWidth: state.aiWidth,
    activeRightPanel: state.activeRightPanel,
    appearanceMode: state.appearanceMode,
  };
}

function updateAndPersist(set: (partial: Partial<LayoutState>) => void, get: () => LayoutState, patch: Partial<LayoutPreferences>): void {
  const next = { ...currentPreferences(get()), ...patch };
  set(next);
  persist(next);
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  ...DEFAULT_LAYOUT_PREFERENCES,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ ...normalizePreferences(readPreferences()), hydrated: true });
  },

  toggleSidebar: () => updateAndPersist(set, get, { sidebarOpen: !get().sidebarOpen }),
  setSidebarWidth: (width) => updateAndPersist(set, get, { sidebarWidth: Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH) }),
  toggleDetail: () => updateAndPersist(set, get, { detailOpen: !get().detailOpen }),
  setDetailWidth: (width) => updateAndPersist(set, get, { detailWidth: Math.min(Math.max(width, DETAIL_MIN_WIDTH), DETAIL_MAX_WIDTH) }),
  setAiOpen: (open) => updateAndPersist(set, get, { aiOpen: open }),
  toggleAi: () => updateAndPersist(set, get, { aiOpen: !get().aiOpen }),
  setAiWidth: (width) => updateAndPersist(set, get, { aiWidth: Math.min(Math.max(width, AI_MIN_WIDTH), AI_MAX_WIDTH) }),
  setActiveRightPanel: (panel) => updateAndPersist(set, get, { activeRightPanel: panel }),
  setAppearanceMode: (mode) => updateAndPersist(set, get, { appearanceMode: mode }),
}));

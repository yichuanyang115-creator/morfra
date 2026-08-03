import { create } from "zustand";
import type { Stage } from "../types/models";
import { defaultStageSort, type StageSort, type SortField } from "../lib/requirementSort";
import { BOARD_DEFAULT_WIDTH, clampBoardWidth, type DetailLayoutMode } from "../lib/boardWidth";

/** 详情面板三态，与 lib/boardWidth.ts 的 DetailLayoutMode 是同一套值域，直接复用避免
 * 两个同语义类型分别声明后维护者改一处忘另一处（Phase 17 code review 发现）。 */
export type DetailMode = DetailLayoutMode;

export type DetailTab = "body" | "produce" | "tasks" | "acceptance" | "activity";

/** Schema 设置页左侧导航的三个区域，"tab" 携带具体 tabId 定位到某个 Tab 的字段配置。 */
export type SettingsSection =
  | { kind: "stages" }
  | { kind: "attributes"; attributeId?: string }
  | { kind: "tab"; tabId: string };

interface UiState {
  selectedRequirementId: string | null;
  detailMode: DetailMode;
  activeTab: DetailTab;
  boardSort: Partial<Record<Stage, StageSort>>;
  boardWidth: number;
  /** null = 设置页未打开。非 null 时 App 用它整屏替换看板内容区（见 REQ-025）。 */
  settingsSection: SettingsSection | null;
  selectRequirement: (id: string) => void;
  toggleClosed: () => void;
  toggleFullscreen: () => void;
  setActiveTab: (tab: DetailTab) => void;
  getStageSort: (stage: Stage) => StageSort;
  setStageSortField: (stage: Stage, slot: "primary", field: SortField) => void;
  setStageSortSecondaryField: (stage: Stage, field: SortField | null) => void;
  toggleStageSortDir: (stage: Stage, slot: "primary" | "secondary") => void;
  restoreStageSort: (stage: Stage) => void;
  setStageSortManual: (stage: Stage) => void;
  setBoardWidth: (width: number, viewportWidth: number) => void;
  openSettings: (section?: SettingsSection) => void;
  setSettingsSection: (section: SettingsSection) => void;
  closeSettings: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  selectedRequirementId: null,
  detailMode: "expanded",
  activeTab: "body",
  boardSort: {},
  boardWidth: BOARD_DEFAULT_WIDTH,
  settingsSection: null,

  selectRequirement: (id) => {
    const current = get().detailMode;
    set({
      selectedRequirementId: id,
      activeTab: "body",
      detailMode: current === "closed" ? "expanded" : current,
    });
  },

  toggleClosed: () => {
    const current = get().detailMode;
    set({ detailMode: current === "closed" ? "expanded" : "closed" });
  },

  toggleFullscreen: () => {
    const current = get().detailMode;
    set({ detailMode: current === "fullscreen" ? "expanded" : "fullscreen" });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  getStageSort: (stage) => get().boardSort[stage] ?? defaultStageSort(),

  setStageSortField: (stage, slot, field) => {
    set((state) => {
      const sort = state.getStageSort(stage);
      return { boardSort: { ...state.boardSort, [stage]: { ...sort, [slot]: field, mode: "rule" } } };
    });
  },

  setStageSortSecondaryField: (stage, field) => {
    set((state) => {
      const sort = state.getStageSort(stage);
      return { boardSort: { ...state.boardSort, [stage]: { ...sort, secondary: field, mode: "rule" } } };
    });
  },

  toggleStageSortDir: (stage, slot) => {
    set((state) => {
      const sort = state.getStageSort(stage);
      const dirKey = slot === "primary" ? "primaryDir" : "secondaryDir";
      const nextDir = sort[dirKey] === "desc" ? "asc" : "desc";
      return { boardSort: { ...state.boardSort, [stage]: { ...sort, [dirKey]: nextDir, mode: "rule" } } };
    });
  },

  restoreStageSort: (stage) => {
    set((state) => {
      const sort = state.getStageSort(stage);
      return { boardSort: { ...state.boardSort, [stage]: { ...sort, mode: "rule" } } };
    });
  },

  setStageSortManual: (stage) => {
    set((state) => {
      const sort = state.getStageSort(stage);
      return { boardSort: { ...state.boardSort, [stage]: { ...sort, mode: "manual" } } };
    });
  },

  setBoardWidth: (width, viewportWidth) => {
    set({ boardWidth: clampBoardWidth(width, viewportWidth) });
  },

  openSettings: (section) => {
    set({ settingsSection: section ?? { kind: "stages" } });
  },

  setSettingsSection: (section) => {
    set({ settingsSection: section });
  },

  closeSettings: () => {
    set({ settingsSection: null });
  },
}));

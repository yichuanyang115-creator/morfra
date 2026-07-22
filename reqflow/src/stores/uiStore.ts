import { create } from "zustand";

export type DetailMode = "expanded" | "collapsed" | "fullscreen";

export type DetailTab = "body" | "produce" | "tasks" | "acceptance" | "activity";

interface UiState {
  selectedRequirementId: string | null;
  detailMode: DetailMode;
  activeTab: DetailTab;
  selectRequirement: (id: string) => void;
  toggleCollapsed: () => void;
  toggleFullscreen: () => void;
  setActiveTab: (tab: DetailTab) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  selectedRequirementId: null,
  detailMode: "expanded",
  activeTab: "body",

  selectRequirement: (id) => {
    const current = get().detailMode;
    set({
      selectedRequirementId: id,
      activeTab: "body",
      detailMode: current === "collapsed" ? "expanded" : current,
    });
  },

  toggleCollapsed: () => {
    const current = get().detailMode;
    set({ detailMode: current === "collapsed" ? "expanded" : "collapsed" });
  },

  toggleFullscreen: () => {
    const current = get().detailMode;
    set({ detailMode: current === "fullscreen" ? "expanded" : "fullscreen" });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },
}));

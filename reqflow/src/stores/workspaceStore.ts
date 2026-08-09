import { create } from "zustand";

interface WorkspaceState {
  activeTableByProject: Record<string, string>;
  activeViewByTable: Record<string, string>;
  setActiveTable: (projectId: string, tableId: string) => void;
  setActiveView: (tableId: string, viewId: string) => void;
  clearProject: (projectId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeTableByProject: {},
  activeViewByTable: {},
  setActiveTable: (projectId, tableId) => set((state) => ({ activeTableByProject: { ...state.activeTableByProject, [projectId]: tableId } })),
  setActiveView: (tableId, viewId) => set((state) => ({ activeViewByTable: { ...state.activeViewByTable, [tableId]: viewId } })),
  clearProject: (projectId) => set((state) => {
    const next = { ...state.activeTableByProject };
    delete next[projectId];
    return { activeTableByProject: next };
  }),
}));

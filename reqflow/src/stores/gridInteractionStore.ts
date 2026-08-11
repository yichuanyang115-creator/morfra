import { create } from "zustand";
import type { JsonValue } from "../types/domain";
import { singleCell, type GridPoint, type GridSelection } from "../lib/table/selectionModel";

export interface EditingCell {
  viewId: string;
  direct?: boolean;
  point: GridPoint;
  recordId: string;
  fieldId: string;
  originalValue: JsonValue;
  draft: JsonValue;
}

export interface PendingCellCommit {
  requestId: string;
  viewId: string;
  recordId: string;
  fieldId: string;
  value: JsonValue;
}

interface GridInteractionState {
  viewId: string | null;
  selection: GridSelection | null;
  editing: EditingCell | null;
  pendingCommit: PendingCellCommit | null;
  saving: boolean;
  error: string | null;
  notice: string | null;
  initialize: (viewId: string) => void;
  setSelection: (selection: GridSelection) => void;
  startEditing: (editing: EditingCell) => void;
  setDraft: (draft: JsonValue) => void;
  stopEditing: () => void;
  beginCommit: (commit: PendingCellCommit) => void;
  completeCommit: (requestId: string) => void;
  failCommit: (requestId: string, message: string) => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
}

export const useGridInteractionStore = create<GridInteractionState>((set, get) => ({
  viewId: null,
  selection: null,
  editing: null,
  pendingCommit: null,
  saving: false,
  error: null,
  notice: null,
  initialize: (viewId) => {
    const state = get();
    if (state.viewId === viewId) return;
    const hasUnsavedEdit = Boolean(state.editing && state.pendingCommit);
    set(hasUnsavedEdit
      ? { viewId, selection: null, notice: "存在未落盘修改，请重试或放弃草稿。" }
      : { viewId, selection: null, editing: null, pendingCommit: null, saving: false, error: null, notice: null });
  },
  setSelection: (selection) => set({ selection, notice: null }),
  startEditing: (editing) => set({ editing, selection: get().selection ?? singleCell(editing.point), error: null, notice: null }),
  setDraft: (draft) => set((state) => state.editing ? { editing: { ...state.editing, draft } } : state),
  stopEditing: () => set({ editing: null, pendingCommit: null, saving: false, error: null, notice: null }),
  beginCommit: (pendingCommit) => set({ pendingCommit, saving: true, error: null, notice: null }),
  completeCommit: (requestId) => set((state) => state.pendingCommit?.requestId === requestId
    ? { editing: null, pendingCommit: null, saving: false, error: null, notice: null }
    : state),
  failCommit: (requestId, error) => set((state) => state.pendingCommit?.requestId === requestId
    ? { saving: false, error, notice: "存在未落盘修改，请重试或放弃草稿。" }
    : state),
  setError: (error) => set({ error }),
  setNotice: (notice) => set({ notice }),
}));

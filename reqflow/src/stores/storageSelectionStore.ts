import { create } from "zustand";
import { getStorageDetailFields, updateStorageDetailFields } from "../lib/ipc/storageClient";

interface StorageSelectionState {
  selectedRecordByTable: Record<string, string | undefined>;
  detailFieldsByTable: Record<string, string[] | undefined>;
  detailLoadErrorByTable: Record<string, string | undefined>;
  selectRecord: (tableId: string, recordId: string | null) => void;
  loadDetailFields: (tableId: string) => Promise<void>;
  setDetailFields: (tableId: string, fieldIds: string[]) => Promise<void>;
}

function storageKey(tableId: string): string { return `morfra.storage.detail-fields.${tableId}`; }

export const useStorageSelectionStore = create<StorageSelectionState>((set) => ({
  selectedRecordByTable: {},
  detailFieldsByTable: {},
  detailLoadErrorByTable: {},
  selectRecord: (tableId, recordId) => set((state) => ({ selectedRecordByTable: { ...state.selectedRecordByTable, [tableId]: recordId ?? undefined } })),
  loadDetailFields: async (tableId) => {
    try {
      const ids = await getStorageDetailFields(tableId);
      set((state) => ({ detailFieldsByTable: { ...state.detailFieldsByTable, [tableId]: ids }, detailLoadErrorByTable: { ...state.detailLoadErrorByTable, [tableId]: undefined } }));
      try { window.localStorage.setItem(storageKey(tableId), JSON.stringify(ids)); } catch { /* 本地缓存失败不影响已保存配置 */ }
    } catch {
      try {
        const raw = window.localStorage.getItem(storageKey(tableId));
        const ids = raw ? JSON.parse(raw) : [];
        set((state) => ({ detailFieldsByTable: { ...state.detailFieldsByTable, [tableId]: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [] }, detailLoadErrorByTable: { ...state.detailLoadErrorByTable, [tableId]: "详情字段配置读取失败，当前使用本地缓存；请重新打开项目后重试" } }));
      } catch {
        set((state) => ({ detailFieldsByTable: { ...state.detailFieldsByTable, [tableId]: [] }, detailLoadErrorByTable: { ...state.detailLoadErrorByTable, [tableId]: "详情字段配置读取失败，请重新打开项目后重试" } }));
      }
    }
  },
  setDetailFields: async (tableId, fieldIds) => {
    const previous = useStorageSelectionStore.getState().detailFieldsByTable[tableId] ?? [];
    set((state) => ({ detailFieldsByTable: { ...state.detailFieldsByTable, [tableId]: fieldIds } }));
    try {
      const saved = await updateStorageDetailFields(tableId, fieldIds);
      set((state) => ({ detailFieldsByTable: { ...state.detailFieldsByTable, [tableId]: saved }, detailLoadErrorByTable: { ...state.detailLoadErrorByTable, [tableId]: undefined } }));
      try { window.localStorage.setItem(storageKey(tableId), JSON.stringify(saved)); } catch { /* 本地缓存失败不影响已保存配置 */ }
    } catch (error) {
      set((state) => ({ detailFieldsByTable: { ...state.detailFieldsByTable, [tableId]: previous } }));
      throw error;
    }
  },
}));

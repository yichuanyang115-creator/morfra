import { create } from "zustand";
import {
  createStorageField,
  createStorageFieldGroup,
  createStorageFieldOption,
  createStorageRecord,
  deleteStorageField,
  deleteStorageFieldGroup,
  deleteStorageFieldOption,
  deleteStorageRecord,
  getStorageFieldOptionUsage,
  loadStorageTableData,
  moveStorageField,
  reorderStorageFieldGroups,
  reorderStorageFieldOptions,
  reorderStorageFields,
  renameStorageFieldGroup,
  updateStorageField,
  updateStorageFieldOption,
  updateStorageCell,
} from "../lib/ipc/storageClient";
import type { FieldType, JsonValue, OptionUsage, TableDataSnapshot } from "../types/domain";

interface TableDataState {
  dataByTable: Record<string, TableDataSnapshot | undefined>;
  loadingByTable: Record<string, boolean | undefined>;
  errorByTable: Record<string, string | undefined>;
  load: (tableId: string) => Promise<TableDataSnapshot>;
  createField: (tableId: string, name: string, fieldType: FieldType, config: JsonValue, groupId: string | null) => Promise<TableDataSnapshot>;
  updateField: (fieldId: string, name: string, fieldType: FieldType, config: JsonValue, groupId: string | null) => Promise<TableDataSnapshot>;
  deleteField: (fieldId: string) => Promise<TableDataSnapshot>;
  createGroup: (tableId: string, name: string) => Promise<TableDataSnapshot>;
  renameGroup: (groupId: string, name: string) => Promise<TableDataSnapshot>;
  deleteGroup: (groupId: string) => Promise<TableDataSnapshot>;
  moveField: (fieldId: string, groupId: string | null) => Promise<TableDataSnapshot>;
  reorderGroups: (tableId: string, groupIds: string[]) => Promise<TableDataSnapshot>;
  reorderFields: (tableId: string, fieldIds: string[]) => Promise<TableDataSnapshot>;
  createOption: (fieldId: string, name: string, color?: string) => Promise<TableDataSnapshot>;
  updateOption: (optionId: string, name: string, color: string) => Promise<TableDataSnapshot>;
  reorderOptions: (fieldId: string, optionIds: string[]) => Promise<TableDataSnapshot>;
  optionUsage: (optionId: string) => Promise<OptionUsage>;
  deleteOption: (optionId: string, mode: "delete" | "replace" | "clear", replacementId: string | null) => Promise<TableDataSnapshot>;
  createRecord: (tableId: string, values: Record<string, JsonValue>) => Promise<TableDataSnapshot>;
  updateCell: (recordId: string, fieldId: string, value: JsonValue) => Promise<TableDataSnapshot>;
  deleteRecord: (recordId: string) => Promise<TableDataSnapshot>;
  clear: (tableId: string) => void;
}

function putSnapshot(set: (state: Partial<TableDataState>) => void, snapshot: TableDataSnapshot): TableDataSnapshot {
  set({ dataByTable: { ...useTableDataStore.getState().dataByTable, [snapshot.tableId]: snapshot }, errorByTable: { ...useTableDataStore.getState().errorByTable, [snapshot.tableId]: undefined } });
  return snapshot;
}

async function runMutation(set: (state: Partial<TableDataState>) => void, action: () => Promise<TableDataSnapshot>): Promise<TableDataSnapshot> {
  try {
    return putSnapshot(set, await action());
  } catch (error) {
    throw error instanceof Error ? error : new Error("表数据操作失败");
  }
}

export const useTableDataStore = create<TableDataState>((set) => ({
  dataByTable: {}, loadingByTable: {}, errorByTable: {},
  load: async (tableId) => {
    set({ loadingByTable: { ...useTableDataStore.getState().loadingByTable, [tableId]: true } });
    try { const snapshot = await loadStorageTableData(tableId); putSnapshot(set, snapshot); return snapshot; }
    catch (error) { set({ errorByTable: { ...useTableDataStore.getState().errorByTable, [tableId]: error instanceof Error ? error.message : "表数据读取失败" } }); throw error; }
    finally { set({ loadingByTable: { ...useTableDataStore.getState().loadingByTable, [tableId]: false } }); }
  },
  createField: (tableId, name, fieldType, config, groupId) => runMutation(set, () => createStorageField(tableId, name, fieldType, config, groupId)),
  updateField: (fieldId, name, fieldType, config, groupId) => runMutation(set, () => updateStorageField(fieldId, name, fieldType, config, groupId)),
  deleteField: (fieldId) => runMutation(set, () => deleteStorageField(fieldId)),
  createGroup: (tableId, name) => runMutation(set, () => createStorageFieldGroup(tableId, name)),
  renameGroup: (groupId, name) => runMutation(set, () => renameStorageFieldGroup(groupId, name)),
  deleteGroup: (groupId) => runMutation(set, () => deleteStorageFieldGroup(groupId)),
  moveField: (fieldId, groupId) => runMutation(set, () => moveStorageField(fieldId, groupId)),
  reorderGroups: (tableId, groupIds) => runMutation(set, () => reorderStorageFieldGroups(tableId, groupIds)),
  reorderFields: (tableId, fieldIds) => runMutation(set, () => reorderStorageFields(tableId, fieldIds)),
  createOption: (fieldId, name, color) => runMutation(set, () => createStorageFieldOption(fieldId, name, color)),
  updateOption: (optionId, name, color) => runMutation(set, () => updateStorageFieldOption(optionId, name, color)),
  reorderOptions: (fieldId, optionIds) => runMutation(set, () => reorderStorageFieldOptions(fieldId, optionIds)),
  optionUsage: (optionId) => getStorageFieldOptionUsage(optionId),
  deleteOption: (optionId, mode, replacementId) => runMutation(set, () => deleteStorageFieldOption(optionId, mode, replacementId)),
  createRecord: (tableId, values) => runMutation(set, () => createStorageRecord(tableId, values)),
  updateCell: (recordId, fieldId, value) => runMutation(set, () => updateStorageCell(recordId, fieldId, value)),
  deleteRecord: (recordId) => runMutation(set, () => deleteStorageRecord(recordId)),
  clear: (tableId) => set({ dataByTable: { ...useTableDataStore.getState().dataByTable, [tableId]: undefined }, errorByTable: { ...useTableDataStore.getState().errorByTable, [tableId]: undefined } }),
}));

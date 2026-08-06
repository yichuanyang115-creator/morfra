import { useRequirementStore } from "./requirementStore";
import type { TabRecord } from "../types/models";

/** 通用 Tab 记录的轻量适配层；实际落盘仍由实体 store 统一写入实体 Markdown。 */
export const useTabRecordStore = {
  recordsFor(requirementId: string, tabId: string): TabRecord[] {
    const requirement = useRequirementStore.getState().requirements.find((item) => item.id === requirementId);
    return (requirement?.tabRecords ?? []).filter((record) => record.tabId === tabId);
  },
  add: (projectId: string, requirementId: string, tabId: string, fieldValues: Record<string, unknown>) =>
    useRequirementStore.getState().addTabRecord(projectId, requirementId, tabId, fieldValues),
  update: (projectId: string, requirementId: string, recordId: string, fieldValues: Record<string, unknown>) =>
    useRequirementStore.getState().updateTabRecord(projectId, requirementId, recordId, fieldValues),
  remove: (projectId: string, requirementId: string, recordId: string) =>
    useRequirementStore.getState().removeTabRecord(projectId, requirementId, recordId),
};

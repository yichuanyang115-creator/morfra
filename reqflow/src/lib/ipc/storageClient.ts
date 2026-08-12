import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ActivityBinding, ActivityComment, ActivityEvent, BackupInfo, BenchmarkReport, FieldType, JsonValue, OptionUsage, ProjectSnapshot, RecordDetailContent, RecordDetailContentInput, StorageAttachment, StorageDetailTab, TableDataSnapshot } from "../../types/domain";

export function isTauriRuntime(): boolean {
  try {
    if (isTauri()) return true;
  } catch {
    // 测试环境可能只 mock invoke；继续使用全局标记回退。
  }
  if (typeof window === "undefined") return false;
  if (window.location.protocol === "tauri:") return true;
  const runtime = window as unknown as Record<string, unknown>;
  return "__TAURI_INTERNALS__" in runtime || "__TAURI__" in runtime;
}

export interface CreateProjectInput {
  path: string;
  name: string;
  template?: "requirements";
}

export async function createStorageProject(input: CreateProjectInput): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_create_project", { path: input.path, name: input.name, ...(input.template ? { template: input.template } : {}) });
}

export async function openStorageProject(path: string): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_open_project", { path });
}

export async function closeStorageProject(): Promise<void> {
  return invoke<void>("storage_close_project");
}

export async function createStorageTable(name: string): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_create_table", { name });
}

export async function renameStorageProject(name: string): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_rename_project", { name });
}

export async function renameStorageTable(tableId: string, name: string): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_rename_table", { tableId, name });
}

export async function deleteStorageTable(tableId: string): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_delete_table", { tableId });
}

export async function restoreDeletedStorageTable(tableId: string): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_restore_deleted_table", { tableId });
}

export async function reorderStorageTables(tableIds: string[]): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_reorder_tables", { tableIds });
}

export async function createStorageView(tableId: string, name: string, viewType: "table" | "board"): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_create_view", { tableId, name, viewType });
}

export async function renameStorageView(viewId: string, name: string): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_rename_view", { viewId, name });
}

export async function duplicateStorageView(viewId: string, name: string): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_duplicate_view", { viewId, name });
}

export async function deleteStorageView(viewId: string): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_delete_view", { viewId });
}

export async function reorderStorageViews(tableId: string, viewIds: string[]): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_reorder_views", { tableId, viewIds });
}

export async function getStorageViewConfig(viewId: string): Promise<JsonValue> {
  return invoke<JsonValue>("storage_get_view_config", { viewId });
}

export async function updateStorageViewConfig(viewId: string, config: JsonValue): Promise<JsonValue> {
  return invoke<JsonValue>("storage_update_view_config", { viewId, config });
}

export async function getStorageDetailFields(tableId: string): Promise<string[]> {
  return invoke<string[]>("storage_get_detail_fields", { tableId });
}

export async function updateStorageDetailFields(tableId: string, fieldIds: string[]): Promise<string[]> {
  return invoke<string[]>("storage_update_detail_fields", { tableId, fieldIds });
}

export async function undoStorageChange(): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_undo");
}

export async function runStorageBenchmark(): Promise<BenchmarkReport> {
  return invoke<BenchmarkReport>("storage_run_benchmark");
}

export async function backupStorageProject(): Promise<BackupInfo> {
  return invoke<BackupInfo>("storage_backup_project");
}

export async function listStorageBackups(): Promise<BackupInfo[]> {
  return invoke<BackupInfo[]>("storage_list_backups");
}

export async function restoreStorageProject(backupId: string): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_restore_project", { backupId });
}
export async function addStorageAttachment(recordId: string, fieldId: string, sourcePath: string): Promise<StorageAttachment> { return invoke<StorageAttachment>("storage_add_attachment", { recordId, fieldId, sourcePath }); }
export async function listStorageAttachments(recordId: string, fieldId: string): Promise<StorageAttachment[]> { return invoke<StorageAttachment[]>("storage_list_attachments", { recordId, fieldId }); }
export async function removeStorageAttachment(attachmentId: string): Promise<void> { return invoke<void>("storage_remove_attachment", { attachmentId }); }
export async function replaceStorageAttachment(attachmentId: string, sourcePath: string): Promise<StorageAttachment> { return invoke<StorageAttachment>("storage_replace_attachment", { attachmentId, sourcePath }); }
export async function storageAttachmentPath(attachmentId: string): Promise<string> { return invoke<string>("storage_attachment_path", { attachmentId }); }

export async function loadStorageTableData(tableId: string): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_load_table_data", { tableId });
}

export async function createStorageField(tableId: string, name: string, fieldType: FieldType, config: JsonValue, groupId: string | null): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_create_field", { tableId, name, fieldType, config, groupId });
}

export async function updateStorageField(fieldId: string, name: string, fieldType: FieldType, config: JsonValue, groupId: string | null): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_update_field", { fieldId, name, fieldType, config, groupId });
}

export async function deleteStorageField(fieldId: string): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_delete_field", { fieldId });
}

export async function createStorageFieldGroup(tableId: string, name: string): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_create_field_group", { tableId, name });
}

export async function renameStorageFieldGroup(groupId: string, name: string): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_rename_field_group", { groupId, name });
}

export async function deleteStorageFieldGroup(groupId: string): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_delete_field_group", { groupId });
}

export async function moveStorageField(fieldId: string, groupId: string | null): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_move_field", { fieldId, groupId });
}

export async function reorderStorageFieldGroups(tableId: string, groupIds: string[]): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_reorder_field_groups", { tableId, groupIds });
}

export async function reorderStorageFields(tableId: string, fieldIds: string[]): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_reorder_fields", { tableId, fieldIds });
}

export async function createStorageFieldOption(fieldId: string, name: string, color?: string): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_create_field_option", { fieldId, name, color });
}

export async function updateStorageFieldOption(optionId: string, name: string, color: string): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_update_field_option", { optionId, name, color });
}

export async function reorderStorageFieldOptions(fieldId: string, optionIds: string[]): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_reorder_field_options", { fieldId, optionIds });
}

export async function getStorageFieldOptionUsage(optionId: string): Promise<OptionUsage> {
  return invoke<OptionUsage>("storage_get_field_option_usage", { optionId });
}

export async function deleteStorageFieldOption(optionId: string, mode: "delete" | "replace" | "clear", replacementId: string | null): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_delete_field_option", { optionId, mode, replacementId });
}

export async function createStorageRecord(tableId: string, values: Record<string, JsonValue>): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_create_record", { tableId, values });
}

export async function updateStorageCell(recordId: string, fieldId: string, value: JsonValue): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_update_cell", { recordId, fieldId, value });
}

export async function deleteStorageRecord(recordId: string): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_delete_record", { recordId });
}

export async function reorderStorageRecords(tableId: string, recordIds: string[]): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_reorder_records", { tableId, recordIds });
}

export async function moveStorageBoardCard(viewId: string, recordId: string, fieldId: string, value: JsonValue, boardConfig: JsonValue): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_move_board_card", { viewId, recordId, fieldId, value, boardConfig });
}

export async function getStorageActivityBinding(tableId: string): Promise<ActivityBinding> { return invoke<ActivityBinding>("storage_get_activity_binding", { tableId }); }
export async function updateStorageActivityBinding(tableId: string, fieldId: string | null): Promise<ActivityBinding> { return invoke<ActivityBinding>("storage_update_activity_binding", { tableId, fieldId }); }
export async function loadStorageActivityEvents(recordId: string): Promise<ActivityEvent[]> { return invoke<ActivityEvent[]>("storage_load_activity_events", { recordId }); }
export async function updateStorageActivityNote(eventId: string, note: string | null): Promise<void> { return invoke<void>("storage_update_activity_note", { eventId, note }); }
export async function createStorageActivityComment(eventId: string, content: string): Promise<ActivityComment> { return invoke<ActivityComment>("storage_create_activity_comment", { eventId, content }); }
export async function deleteStorageActivityEvent(eventId: string): Promise<void> { return invoke<void>("storage_delete_activity_event", { eventId }); }
export async function getStorageDetailTabs(tableId: string): Promise<StorageDetailTab[]> { return invoke<StorageDetailTab[]>("storage_get_detail_tabs", { tableId }); }
export async function loadStorageRecordDetailContent(recordId: string): Promise<RecordDetailContent> { return invoke<RecordDetailContent>("storage_load_record_detail_content", { recordId }); }
export async function saveStorageRecordDetailContent(recordId: string, content: RecordDetailContentInput): Promise<RecordDetailContent> { return invoke<RecordDetailContent>("storage_save_record_detail_content", { recordId, content }); }

export interface StorageCellUpdate { recordId: string; fieldId: string; value: JsonValue; }
export interface StorageNewRecord { values: Record<string, JsonValue>; }

export async function applyStorageTableMutation(tableId: string, updates: StorageCellUpdate[], newRecords: StorageNewRecord[] = [], deleteRecordIds: string[] = []): Promise<TableDataSnapshot> {
  return invoke<TableDataSnapshot>("storage_apply_table_mutation", { tableId, updates, newRecords, deleteRecordIds });
}

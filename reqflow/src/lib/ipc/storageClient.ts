import { invoke, isTauri } from "@tauri-apps/api/core";
import type { BackupInfo, BenchmarkReport, ProjectSnapshot } from "../../types/domain";

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
}

export async function createStorageProject(input: CreateProjectInput): Promise<ProjectSnapshot> {
  return invoke<ProjectSnapshot>("storage_create_project", { path: input.path, name: input.name });
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

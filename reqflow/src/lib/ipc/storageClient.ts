import { invoke } from "@tauri-apps/api/core";
import type { BackupInfo, BenchmarkReport, ProjectSnapshot } from "../../types/domain";

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

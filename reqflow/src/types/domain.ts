export type ViewType = "table" | "board";

export interface ProjectManifest {
  id: string;
  name: string;
  formatVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ViewSummary {
  id: string;
  name: string;
  viewType: ViewType;
  position: number;
}

export interface TableSummary {
  id: string;
  name: string;
  position: number;
  titleFieldId: string;
  recordCount: number;
  views: ViewSummary[];
}

export interface ProjectSnapshot {
  manifest: ProjectManifest;
  tables: TableSummary[];
}

export interface StorageError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface BenchmarkReport {
  recordCount: number;
  fieldCount: number;
  matchedCandidates: number;
  candidateQueryMs: number;
}

export interface BackupInfo {
  id: string;
  createdAt: string;
}

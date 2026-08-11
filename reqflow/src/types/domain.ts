export type ViewType = "table" | "board";
export type FieldType = "text" | "select" | "multi_select" | "number" | "progress" | "date" | "image" | "file" | "link" | "checkbox" | "auto_number" | "created_time" | "updated_time";
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

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

export interface FieldSummary {
  id: string;
  tableId: string;
  groupId: string | null;
  name: string;
  fieldType: FieldType;
  isTitle: boolean;
  position: number;
  config: JsonValue;
  options: FieldOptionSummary[];
}

export interface FieldGroupSummary {
  id: string;
  tableId: string;
  name: string;
  position: number;
}

export interface FieldOptionSummary {
  id: string;
  fieldId: string | null;
  name: string;
  color: string;
  position: number;
}

export interface RecordData {
  id: string;
  tableId: string;
  position: number;
  autoNumber: number;
  createdAt: string;
  updatedAt: string;
  values: Record<string, JsonValue>;
  multiSelectValues: Record<string, string[]>;
}

export interface TableDataSnapshot {
  tableId: string;
  groups: FieldGroupSummary[];
  fields: FieldSummary[];
  records: RecordData[];
}

export interface OptionUsage {
  recordCount: number;
  viewRuleCount: number;
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

export interface RecentProject {
  id: string;
  path: string;
  name: string;
  lastOpenedAt: string;
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

export interface StorageAttachment {
  id: string;
  recordId: string;
  fieldId: string;
  relativePath: string;
  originalName: string;
  mediaType: string | null;
  byteSize: number;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  recordId: string;
  fieldId: string;
  fieldNameSnapshot: string;
  fromValueSnapshot: string | null;
  toValueSnapshot: string | null;
  occurredAt: string;
  note: string | null;
  comments: ActivityComment[];
}

export interface ActivityComment { id: string; eventId: string; content: string; createdAt: string; }
export interface ActivityBinding { enabled: boolean; fieldId: string | null; }

export interface StorageDetailTab { id: string; name: string; renderer: "body" | "deliverables" | "tasks" | "acceptance" | "activity"; visible: boolean; }

export interface RecordDetailContent {
  recordId: string;
  body: string;
  deliverables: import("./models").Deliverable[];
  tasks: import("./models").Task[];
  acceptance: import("./models").AcceptanceCriterion[];
}
export type RecordDetailContentInput = Omit<RecordDetailContent, "recordId">;

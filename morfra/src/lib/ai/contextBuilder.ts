import type { AIAnalysisPlan } from "../../types/ai";
import {
  executeAnalysisPlan,
  type AnalysisResult,
} from "./analysisEngine";
import {
  validateAnalysisPlan,
  type AnalysisPlanIssue,
} from "./analysisPlan";
import { getRecordTitle, type TableCellValue, type TableField, type TableSnapshot } from "./tableSnapshot";

export interface MinimalAnswerContext {
  source: "local-analysis";
  table: { tableId: string; name: string; schemaVersion: string; capturedAt: string };
  scope: { type: "fullTable" | "selectedRecords"; recordIds: string[] };
  fields: TableField[];
  records: Array<{ recordId: string; title: string; values: Record<string, TableCellValue> }>;
  analysis: AnalysisResult;
}

export interface AnalysisContextOptions {
  recordIds?: readonly string[];
  maxContextRecords?: number;
}

export type AnalysisContextResult =
  | { ok: true; context: MinimalAnswerContext }
  | { ok: false; code: "invalid-analysis-plan" | "model-incompatible"; issues: AnalysisPlanIssue[] };

function referencedFieldIds(plan: AIAnalysisPlan, snapshot: TableSnapshot): Set<string> {
  const ids = new Set<string>([snapshot.primaryTitleFieldId, ...plan.projections, ...plan.groupBy]);
  for (const filter of plan.filters) ids.add(filter.fieldId);
  for (const aggregate of plan.aggregates) if (aggregate.fieldId) ids.add(aggregate.fieldId);
  for (const rule of plan.sort) ids.add(rule.fieldId);
  return ids;
}

function buildContext(
  snapshot: TableSnapshot,
  plan: AIAnalysisPlan,
  result: AnalysisResult,
  options: AnalysisContextOptions,
): MinimalAnswerContext {
  const fieldIds = referencedFieldIds(plan, snapshot);
  const fields = snapshot.fields.filter((field) => fieldIds.has(field.id));
  const maxRecords = Math.max(1, Math.min(options.maxContextRecords ?? 100, 100));
  const recordIds = [...new Set(result.rows.map((row) => row.recordId))];
  for (const group of result.groups) {
    for (const recordId of group.recordIds) {
      if (recordIds.length >= maxRecords) break;
      if (!recordIds.includes(recordId)) recordIds.push(recordId);
    }
  }
  for (const aggregate of result.aggregates) {
    for (const recordId of aggregate.contributingRecordIds) {
      if (recordIds.length >= maxRecords) break;
      if (!recordIds.includes(recordId)) recordIds.push(recordId);
    }
  }
  const records = recordIds.slice(0, maxRecords).flatMap((recordId) => {
    const record = snapshot.records.find((candidate) => candidate.id === recordId);
    if (!record) return [];
    return [{
      recordId: record.id,
      title: getRecordTitle(snapshot, record.id),
      values: Object.fromEntries(fields.map((field) => [field.id, record.values[field.id]])),
    }];
  });
  const analysis: AnalysisResult = {
    ...result,
    matchingRecordIds: result.matchingRecordIds.filter((recordId) => recordIds.slice(0, maxRecords).includes(recordId)),
    rows: result.rows.filter((row) => recordIds.slice(0, maxRecords).includes(row.recordId)).slice(0, maxRecords),
    groups: result.groups.map((group) => ({
      ...group,
      recordIds: group.recordIds.filter((recordId) => recordIds.slice(0, maxRecords).includes(recordId)).slice(0, maxRecords),
    })),
    aggregates: result.aggregates.map((aggregate) => ({
      ...aggregate,
      contributingRecordIds: aggregate.contributingRecordIds.filter((recordId) => recordIds.slice(0, maxRecords).includes(recordId)).slice(0, maxRecords),
    })),
  };
  return {
    source: "local-analysis",
    table: {
      tableId: snapshot.tableId,
      name: snapshot.name,
      schemaVersion: snapshot.schemaVersion,
      capturedAt: snapshot.capturedAt,
    },
    scope: {
      type: options.recordIds ? "selectedRecords" : "fullTable",
      recordIds: result.scopeRecordIds,
    },
    fields,
    records,
    analysis,
  };
}

function sanitizeSelectedRecordIds(snapshot: TableSnapshot, options: AnalysisContextOptions): AnalysisContextOptions {
  if (options.recordIds === undefined) return options;
  const validIds = new Set(snapshot.records.map((record) => record.id));
  return { ...options, recordIds: options.recordIds.filter((recordId) => validIds.has(recordId)) };
}

export function prepareAnalysisContext(
  snapshot: TableSnapshot,
  rawPlan: unknown,
  options: AnalysisContextOptions = {},
): AnalysisContextResult {
  const scopedOptions = sanitizeSelectedRecordIds(snapshot, options);
  const validation = validateAnalysisPlan(rawPlan, snapshot, scopedOptions);
  if (!validation.ok) return { ok: false, code: "invalid-analysis-plan", issues: validation.issues };
  const executionOptions = scopedOptions.recordIds === undefined ? {} : { recordIds: validation.recordIds };
  const execution = executeAnalysisPlan(snapshot, validation.plan, executionOptions);
  if (!execution.ok) return { ok: false, code: "invalid-analysis-plan", issues: execution.issues };
  return { ok: true, context: buildContext(snapshot, validation.plan, execution.result, scopedOptions) };
}

export function prepareAnalysisContextWithRetries(
  snapshot: TableSnapshot,
  planCandidates: readonly unknown[],
  options: AnalysisContextOptions = {},
  maxAttempts = 2,
): AnalysisContextResult {
  const attempts = Math.max(1, Math.min(Math.floor(maxAttempts), 3));
  const issues: AnalysisPlanIssue[] = [];
  for (const candidate of planCandidates.slice(0, attempts)) {
    const result = prepareAnalysisContext(snapshot, candidate, options);
    if (result.ok) return result;
    issues.push(...result.issues);
  }
  return {
    ok: false,
    code: "model-incompatible",
    issues: issues.length > 0
      ? issues
      : [{ code: "invalid-shape", path: "plan", message: "模型未返回可执行分析计划" }],
  };
}

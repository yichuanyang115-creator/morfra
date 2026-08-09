import { AI_EVALUATION_TABLES } from "../../fixtures/aiEvaluationTables";
import { prepareAnalysisContext } from "./contextBuilder";
import { AI_EVALUATION_CASES, type AnalysisCase, type IsolationCase, type RouteCase } from "./evaluationCases";
import { routeContext } from "./contextRouter";
import type { TableDataAdapter, TableSnapshot } from "./tableDataAdapter";
import { getRecordTitle } from "./tableSnapshot";

export interface AIEvaluationFailure {
  caseId: string;
  message: string;
}
export interface AIEvaluationReport {
  total: number;
  passed: number;
  failures: AIEvaluationFailure[];
}
function tableFor(tableId: string): TableSnapshot {
  const table = AI_EVALUATION_TABLES.find((candidate) => candidate.tableId === tableId);
  if (!table) throw new Error(`评估表不存在：${tableId}`);
  return table;
}
function checkAnalysisCaseAgainstSnapshot(testCase: AnalysisCase, snapshot: TableSnapshot): AIEvaluationFailure | null {
  const context = prepareAnalysisContext(snapshot, testCase.plan, { recordIds: testCase.recordIds });
  if (testCase.expected.valid !== context.ok) return {
    caseId: testCase.id,
    message: `valid 预期 ${testCase.expected.valid}，实际 ${context.ok}${context.ok ? "" : `：${JSON.stringify(context.issues)}`}`,
  };
  if (!context.ok) return null;
  if (context.context.table.tableId !== testCase.tableId) return { caseId: testCase.id, message: "回答上下文表 ID 不一致" };
  const snapshotRecordIds = new Set(snapshot.records.map((record) => record.id));
  const scopedRecordIds = new Set(context.context.analysis.scopeRecordIds);
  for (const record of context.context.records) {
    if (!snapshotRecordIds.has(record.recordId) || !scopedRecordIds.has(record.recordId) || !context.context.analysis.matchingRecordIds.includes(record.recordId)) return { caseId: testCase.id, message: "回答引用了不存在或范围外记录" };
    if (record.title !== getRecordTitle(snapshot, record.recordId)) return { caseId: testCase.id, message: "记录引用标题与主标题字段不一致" };
  }
  const result = context.context.analysis;
  const contextRecordIds = new Set(context.context.records.map((record) => record.recordId));
  if (result.rows.some((row) => !contextRecordIds.has(row.recordId))) return { caseId: testCase.id, message: "分析行缺少对应记录引用" };
  if (result.groups.some((group) => group.recordIds.some((recordId) => !contextRecordIds.has(recordId)))) return { caseId: testCase.id, message: "分组引用缺少对应记录实体" };
  if (result.aggregates.some((aggregate) => aggregate.contributingRecordIds.some((recordId) => !contextRecordIds.has(recordId)))) return { caseId: testCase.id, message: "聚合引用缺少对应记录实体" };
  if (testCase.recordIds !== undefined) {
    const expectedScope = testCase.recordIds.filter((recordId) => snapshotRecordIds.has(recordId));
    if (JSON.stringify(result.scopeRecordIds) !== JSON.stringify(expectedScope)) return { caseId: testCase.id, message: "scopeRecordIds 不一致" };
  }
  if (testCase.expected.filteredCount !== undefined && result.filteredCount !== testCase.expected.filteredCount) return { caseId: testCase.id, message: `filteredCount 不一致：实际 ${result.filteredCount}` };
  if (testCase.expected.matchingRecordIds && JSON.stringify(result.matchingRecordIds) !== JSON.stringify(testCase.expected.matchingRecordIds)) return { caseId: testCase.id, message: "matchingRecordIds 不一致" };
  if (testCase.expected.rowIds && JSON.stringify(result.rows.map((row) => row.recordId)) !== JSON.stringify(testCase.expected.rowIds)) return { caseId: testCase.id, message: "rowIds 不一致" };
  for (const [id, expected] of Object.entries(testCase.expected.aggregateValues ?? {})) {
    const actual = result.aggregates.find((aggregate) => aggregate.id === id)?.value;
    if (typeof actual === "number" && typeof expected === "number" ? Math.abs(actual - expected) > 1e-9 : actual !== expected) return { caseId: testCase.id, message: `聚合 ${id} 不一致` };
  }
  for (const [id, expected] of Object.entries(testCase.expected.aggregateStatuses ?? {})) {
    const actual = result.aggregates.find((aggregate) => aggregate.id === id)?.status;
    if (actual !== expected) return { caseId: testCase.id, message: `聚合 ${id} 的数据充分性状态不一致` };
  }
  if (testCase.expected.groups) {
    const actual = Object.fromEntries(result.groups.map((group) => [group.label, group.count]));
    if (JSON.stringify(actual) !== JSON.stringify(testCase.expected.groups)) return { caseId: testCase.id, message: "分组结果不一致" };
  }
  return null;
}
function checkAnalysisCase(testCase: AnalysisCase): AIEvaluationFailure | null {
  return checkAnalysisCaseAgainstSnapshot(testCase, tableFor(testCase.tableId));
}
function checkRouteCase(testCase: RouteCase): AIEvaluationFailure | null {
  const actual = routeContext(testCase);
  return actual.type === testCase.expected.type ? null : { caseId: testCase.id, message: `路由预期 ${testCase.expected.type}，实际 ${actual.type}` };
}
function checkIsolationCase(testCase: IsolationCase, snapshots = testCase.tableIds.map(tableFor)): AIEvaluationFailure | null {
  for (const [index, snapshot] of snapshots.entries()) {
    const context = prepareAnalysisContext(snapshot, { filters: [], projections: ["title", "score"], groupBy: [], aggregates: [], sort: [], limit: null });
    if (!context.ok) return { caseId: testCase.id, message: `第 ${index + 1} 张表无法生成上下文` };
    const recordIds = context.context.records.map((record) => record.recordId);
    if (context.context.table.tableId !== testCase.tableIds[index] || JSON.stringify(recordIds) !== JSON.stringify([testCase.expectedRecordIds[index]])) return { caseId: testCase.id, message: "表 ID 或记录引用发生串表" };
  }
  return null;
}
export function evaluateAICases(): AIEvaluationReport {
  const failures: AIEvaluationFailure[] = [];
  for (const testCase of AI_EVALUATION_CASES) {
    const failure = testCase.kind === "analysis" ? checkAnalysisCase(testCase) : testCase.kind === "route" ? checkRouteCase(testCase) : checkIsolationCase(testCase);
    if (failure) failures.push(failure);
  }
  return { total: AI_EVALUATION_CASES.length, passed: AI_EVALUATION_CASES.length - failures.length, failures };
}
export async function evaluateAIAdapter(adapter: TableDataAdapter): Promise<AIEvaluationReport> {
  const failures: AIEvaluationFailure[] = [];
  for (const testCase of AI_EVALUATION_CASES) {
    if (testCase.kind === "route") {
      const failure = checkRouteCase(testCase);
      if (failure) failures.push(failure);
      continue;
    }
    if (testCase.kind === "isolation") {
      const snapshots = await Promise.all(testCase.tableIds.map((tableId) => adapter.getTableSnapshot(tableId)));
      const failure = checkIsolationCase(testCase, snapshots);
      if (failure) failures.push(failure);
      continue;
    }
    const failure = checkAnalysisCaseAgainstSnapshot(testCase, await adapter.getTableSnapshot(testCase.tableId));
    if (failure) failures.push(failure);
  }
  return { total: AI_EVALUATION_CASES.length, passed: AI_EVALUATION_CASES.length - failures.length, failures };
}

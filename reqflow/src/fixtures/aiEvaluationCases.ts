import { AI_EVALUATION_CASES, evaluateAICases } from "../lib/ai/evaluation";
import { prepareAnalysisContextWithRetries } from "../lib/ai/contextBuilder";
import { AI_EVALUATION_TABLES } from "./aiEvaluationTables";

export interface AIEvaluationAuditCase {
  id: string;
  category: "analysis" | "routing" | "isolation" | "lifecycle" | "privacy";
  evidence: string;
}

export type Phase7ExternalEvaluationId = "restart-restore" | "delete-cascade" | "key-privacy";

export type Phase7ExternalEvaluators = Readonly<Record<Phase7ExternalEvaluationId, () => void | Promise<void>>>;

/** Phase 7 的固定审计目录；实际数值由现有本地评估引擎执行，不由模型提供。 */
export const AI_PHASE_7_EVALUATION_CASES: readonly AIEvaluationAuditCase[] = [
  { id: "count", category: "analysis", evidence: "empty-table-count" },
  { id: "percentage", category: "analysis", evidence: "delivery-percentage" },
  { id: "sum", category: "analysis", evidence: "mixed-number-aggregates" },
  { id: "average", category: "analysis", evidence: "mixed-number-aggregates" },
  { id: "group", category: "analysis", evidence: "delivery-group-and-sort" },
  { id: "sort", category: "analysis", evidence: "delivery-group-and-sort" },
  { id: "null", category: "analysis", evidence: "mixed-null-filter" },
  { id: "invalid-field", category: "analysis", evidence: "invalid-field" },
  { id: "invalid-operation", category: "analysis", evidence: "invalid-text-sum" },
  { id: "model-incompatible", category: "analysis", evidence: "invalid-plan-retry" },
  { id: "insufficient-data", category: "analysis", evidence: "insufficient-numeric-data" },
  { id: "full-table", category: "routing", evidence: "selection-without-reference-is-full-table" },
  { id: "selected-records", category: "routing", evidence: "selected-records-explicit-only" },
  { id: "selection-not-referenced", category: "routing", evidence: "selection-without-reference-is-full-table" },
  { id: "general-none", category: "routing", evidence: "general-question-does-not-read-table" },
  { id: "record-references", category: "isolation", evidence: "same-name-table-a" },
  { id: "cross-table-isolation", category: "isolation", evidence: "cross-table-isolation" },
  { id: "restart-restore", category: "lifecycle", evidence: "persistence.test.ts" },
  { id: "delete-cascade", category: "lifecycle", evidence: "deleteTableAIDataAndVerify" },
  { id: "key-privacy", category: "privacy", evidence: "repository scan" },
];

export async function runPhase7EvaluationSet(externalEvaluators: Phase7ExternalEvaluators): Promise<{ total: number; passed: number; failures: string[] }> {
  const report = evaluateAICases();
  const knownCaseIds = new Set(AI_EVALUATION_CASES.map((testCase) => testCase.id));
  const failures = report.failures.map((failure) => `${failure.caseId}: ${failure.message}`);
  for (const testCase of AI_PHASE_7_EVALUATION_CASES) {
    if (testCase.id === "restart-restore" || testCase.id === "delete-cascade" || testCase.id === "key-privacy") {
      try {
        await externalEvaluators[testCase.id]();
      } catch (error) {
        failures.push(`${testCase.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
      continue;
    }
    if (testCase.evidence === "invalid-plan-retry") {
      const invalid = prepareAnalysisContextWithRetries(AI_EVALUATION_TABLES[0], [{ filters: "not-an-array" }]);
      if (invalid.ok || invalid.code !== "model-incompatible") failures.push(`${testCase.id}: 未阻断模型不兼容计划`);
      continue;
    }
    if (!knownCaseIds.has(testCase.evidence)) failures.push(`${testCase.id}: 缺少固定评估用例 ${testCase.evidence}`);
  }
  return { total: AI_PHASE_7_EVALUATION_CASES.length, passed: AI_PHASE_7_EVALUATION_CASES.length - failures.length, failures };
}

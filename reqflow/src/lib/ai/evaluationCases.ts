import type { AIAnalysisPlan, AIConversationMode } from "../../types/ai";
import type { AIContextRoute } from "./contextRouter";
import { AI_EVALUATION_CONTEXT_CASES } from "./evaluationContextCases";

export type AnalysisCase = {
  kind: "analysis";
  id: string;
  tableId: string;
  plan: unknown;
  recordIds?: readonly string[];
  expected: {
    filteredCount?: number;
    matchingRecordIds?: readonly string[];
    rowIds?: readonly string[];
    aggregateValues?: Record<string, number | null>;
    aggregateStatuses?: Record<string, "computed" | "insufficient-data">;
    groups?: Record<string, number>;
    valid: boolean;
  };
};

export type RouteCase = {
  kind: "route";
  id: string;
  mode: AIConversationMode;
  message: string;
  selectionReferenced?: boolean;
  selectedRecordIds?: readonly string[];
  expected: Pick<AIContextRoute, "type">;
};

export type IsolationCase = {
  kind: "isolation";
  id: string;
  tableIds: readonly [string, string];
  expectedRecordIds: readonly [string, string];
};

export type AIEvaluationCase = AnalysisCase | RouteCase | IsolationCase;

const plan = (overrides: Partial<AIAnalysisPlan> = {}): AIAnalysisPlan => ({
  filters: [],
  projections: [],
  groupBy: [],
  aggregates: [],
  sort: [],
  limit: null,
  ...overrides,
});

export const AI_EVALUATION_CASES: readonly AIEvaluationCase[] = [
  {
    kind: "analysis",
    id: "empty-table-count",
    tableId: "table-empty",
    plan: plan({ aggregates: [{ id: "count", operation: "count" }] }),
    expected: { filteredCount: 0, aggregateValues: { count: 0 }, valid: true },
  },
  {
    kind: "analysis",
    id: "mixed-null-filter",
    tableId: "table-mixed",
    plan: plan({
      filters: [{ fieldId: "progress", operator: "isEmpty" }],
      aggregates: [{ id: "count", operation: "count" }],
    }),
    expected: { filteredCount: 1, matchingRecordIds: ["mixed-1"], aggregateValues: { count: 1 }, valid: true },
  },
  {
    kind: "analysis",
    id: "delivery-filter-not-equals",
    tableId: "table-delivery",
    plan: plan({ filters: [{ fieldId: "status", operator: "notEquals", value: "done" }] }),
    expected: { filteredCount: 2, matchingRecordIds: ["delivery-2", "delivery-3"], valid: true },
  },
  {
    kind: "analysis",
    id: "delivery-filter-is-not-empty",
    tableId: "table-delivery",
    plan: plan({ filters: [{ fieldId: "dueDate", operator: "isNotEmpty" }] }),
    expected: { filteredCount: 2, matchingRecordIds: ["delivery-1", "delivery-2"], valid: true },
  },
  {
    kind: "analysis",
    id: "delivery-filter-greater-than-or-equal",
    tableId: "table-delivery",
    plan: plan({ filters: [{ fieldId: "effort", operator: "greaterThanOrEqual", value: 5 }] }),
    expected: { filteredCount: 2, matchingRecordIds: ["delivery-2", "delivery-3"], valid: true },
  },
  {
    kind: "analysis",
    id: "delivery-filter-less-than",
    tableId: "table-delivery",
    plan: plan({ filters: [{ fieldId: "effort", operator: "lessThan", value: 5 }] }),
    expected: { filteredCount: 1, matchingRecordIds: ["delivery-1"], valid: true },
  },
  {
    kind: "analysis",
    id: "delivery-filter-less-than-or-equal",
    tableId: "table-delivery",
    plan: plan({ filters: [{ fieldId: "effort", operator: "lessThanOrEqual", value: 5 }] }),
    expected: { filteredCount: 2, matchingRecordIds: ["delivery-1", "delivery-2"], valid: true },
  },
  {
    kind: "analysis",
    id: "mixed-text-contains",
    tableId: "table-mixed",
    plan: plan({ filters: [{ fieldId: "title", operator: "contains", value: "重复" }] }),
    expected: { filteredCount: 2, matchingRecordIds: ["mixed-1", "mixed-2"], valid: true },
  },
  {
    kind: "analysis",
    id: "mixed-multiselect-contains",
    tableId: "table-mixed",
    plan: plan({ filters: [{ fieldId: "tags", operator: "contains", value: "alpha" }] }),
    expected: { filteredCount: 1, matchingRecordIds: ["mixed-1"], valid: true },
  },
  {
    kind: "analysis",
    id: "mixed-checkbox-equals",
    tableId: "table-mixed",
    plan: plan({ filters: [{ fieldId: "checked", operator: "equals", value: true }] }),
    expected: { filteredCount: 1, matchingRecordIds: ["mixed-1"], valid: true },
  },
  {
    kind: "analysis",
    id: "mixed-computed-not-equals",
    tableId: "table-mixed",
    plan: plan({ filters: [{ fieldId: "computed", operator: "notEquals", value: 1 }] }),
    expected: { filteredCount: 1, matchingRecordIds: ["mixed-2"], valid: true },
  },
  {
    kind: "analysis",
    id: "mixed-attachment-is-empty",
    tableId: "table-mixed",
    plan: plan({ filters: [{ fieldId: "files", operator: "isEmpty" }] }),
    expected: { filteredCount: 1, matchingRecordIds: ["mixed-2"], valid: true },
  },
  {
    kind: "analysis",
    id: "date-filter-normalizes-input",
    tableId: "table-mixed",
    plan: plan({ filters: [{ fieldId: "dueDate", operator: "equals", value: "2026/08/09" }] }),
    expected: { filteredCount: 1, matchingRecordIds: ["mixed-2"], valid: true },
  },
  {
    kind: "analysis",
    id: "mixed-number-aggregates",
    tableId: "table-mixed",
    plan: plan({
      aggregates: [
        { id: "sum", operation: "sum", fieldId: "amount" },
        { id: "average", operation: "average", fieldId: "progress" },
        { id: "minimum", operation: "minimum", fieldId: "amount" },
        { id: "maximum", operation: "maximum", fieldId: "amount" },
      ],
    }),
    expected: { filteredCount: 2, aggregateValues: { sum: 10, average: 50, minimum: 10, maximum: 10 }, valid: true },
  },
  {
    kind: "analysis",
    id: "delivery-percentage",
    tableId: "table-delivery",
    plan: plan({
      filters: [{ fieldId: "status", operator: "equals", value: "done" }],
      aggregates: [{ id: "percentage", operation: "percentage" }],
    }),
    expected: { filteredCount: 1, aggregateValues: { percentage: 100 / 3 }, valid: true },
  },
  {
    kind: "analysis",
    id: "insufficient-numeric-data",
    tableId: "table-mixed",
    plan: plan({
      filters: [{ fieldId: "amount", operator: "greaterThan", value: 100 }],
      aggregates: [{ id: "average", operation: "average", fieldId: "amount" }],
    }),
    expected: { filteredCount: 0, aggregateValues: { average: null }, aggregateStatuses: { average: "insufficient-data" }, valid: true },
  },
  {
    kind: "analysis",
    id: "delivery-group-and-sort",
    tableId: "table-delivery",
    plan: plan({
      projections: ["title", "effort"],
      groupBy: ["status"],
      sort: [{ fieldId: "effort", direction: "descending" }],
      limit: 2,
    }),
    expected: {
      filteredCount: 3,
      rowIds: ["delivery-3", "delivery-2"],
      groups: { "状态：已完成": 1, "状态：进行中": 1, "状态：待处理": 1 },
      valid: true,
    },
  },
  {
    kind: "analysis",
    id: "selected-record-range",
    tableId: "table-delivery",
    recordIds: ["delivery-2", "delivery-3"],
    plan: plan({ aggregates: [{ id: "effort", operation: "sum", fieldId: "effort" }] }),
    expected: { filteredCount: 2, matchingRecordIds: ["delivery-2", "delivery-3"], aggregateValues: { effort: 13 }, valid: true },
  },
  {
    kind: "analysis",
    id: "same-name-table-a",
    tableId: "table-same-name-a",
    plan: plan({ aggregates: [{ id: "score", operation: "sum", fieldId: "score" }] }),
    expected: { aggregateValues: { score: 10 }, matchingRecordIds: ["same-a-1"], valid: true },
  },
  {
    kind: "analysis",
    id: "same-name-table-b",
    tableId: "table-same-name-b",
    plan: plan({ aggregates: [{ id: "score", operation: "sum", fieldId: "score" }] }),
    expected: { aggregateValues: { score: 99 }, matchingRecordIds: ["same-b-1"], valid: true },
  },
  {
    kind: "analysis",
    id: "invalid-field",
    tableId: "table-delivery",
    plan: plan({ projections: ["does-not-exist"] }),
    expected: { valid: false },
  },
  {
    kind: "analysis",
    id: "invalid-text-sum",
    tableId: "table-delivery",
    plan: plan({ aggregates: [{ id: "bad", operation: "sum", fieldId: "title" }] }),
    expected: { valid: false },
  },
  {
    kind: "analysis",
    id: "invalid-select-option",
    tableId: "table-delivery",
    plan: plan({ filters: [{ fieldId: "status", operator: "equals", value: "missing" }] }),
    expected: { valid: false },
  },
  {
    kind: "analysis",
    id: "invalid-filter-operation",
    tableId: "table-delivery",
    plan: plan({ filters: [{ fieldId: "dueDate", operator: "contains", value: "2026" }] }),
    expected: { valid: false },
  },
  {
    kind: "analysis",
    id: "invalid-computed-operation",
    tableId: "table-mixed",
    plan: plan({ filters: [{ fieldId: "computed", operator: "contains", value: "1" }] }),
    expected: { valid: false },
  },
  {
    kind: "analysis",
    id: "invalid-record-range",
    tableId: "table-delivery",
    recordIds: ["missing-record"],
    plan: plan({ aggregates: [{ id: "count", operation: "count" }] }),
    expected: { valid: false },
  },
  {
    kind: "analysis",
    id: "invalid-result-size",
    tableId: "table-delivery",
    plan: plan({ limit: 101 }),
    expected: { valid: false },
  },
  ...AI_EVALUATION_CONTEXT_CASES,
];

import type { IsolationCase, RouteCase } from "./evaluationCases";

export const AI_EVALUATION_CONTEXT_CASES: readonly (RouteCase | IsolationCase)[] = [
  {
    kind: "isolation",
    id: "cross-table-isolation",
    tableIds: ["table-same-name-a", "table-same-name-b"],
    expectedRecordIds: ["same-a-1", "same-b-1"],
  },
  {
    kind: "route",
    id: "general-question-does-not-read-table",
    mode: "general",
    message: "你好，解释一下什么是番茄工作法",
    expected: { type: "none" },
  },
  {
    kind: "route",
    id: "table-question-reads-table",
    mode: "general",
    message: "表里有多少条记录？",
    expected: { type: "fullTable" },
  },
  {
    kind: "route",
    id: "natural-table-question-reads-table",
    mode: "general",
    message: "最近有什么待处理的工作？",
    expected: { type: "fullTable" },
  },
  {
    kind: "route",
    id: "ambiguous-question-asks-first",
    mode: "general",
    message: "帮我总结一下",
    expected: { type: "clarification" },
  },
  {
    kind: "route",
    id: "selected-records-explicit-only",
    mode: "table-analysis",
    message: "求和",
    selectionReferenced: true,
    selectedRecordIds: ["delivery-1"],
    expected: { type: "selectedRecords" },
  },
  {
    kind: "route",
    id: "selection-without-reference-is-full-table",
    mode: "table-analysis",
    message: "总数",
    selectionReferenced: false,
    selectedRecordIds: ["delivery-1"],
    expected: { type: "fullTable" },
  },
];

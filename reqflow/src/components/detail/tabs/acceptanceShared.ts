import type { AcceptanceCriterion, AcceptanceResult } from "../../../types/models";
import { ACCEPTANCE_RESULTS } from "../../../types/models";

export type AcceptancePatch = Partial<Pick<AcceptanceCriterion, "desc" | "result" | "failNote">>;

export const ACCEPTANCE_RESULT_LABEL: Record<AcceptanceResult, string> = Object.fromEntries(
  ACCEPTANCE_RESULTS.map((r) => [r.key, r.label]),
) as Record<AcceptanceResult, string>;

export const ACCEPTANCE_RESULT_ORDER: AcceptanceResult[] = ["pass", "fail", "unverified"];

export const RESULT_BTN_STYLE: Record<AcceptanceResult, string> = {
  pass: "text-(--module-scope-feedback-success)",
  fail: "text-(--module-scope-feedback-danger)",
  unverified: "text-(--module-scope-context-strong)",
};

export const RESULT_DOT_STYLE: Record<AcceptanceResult, string> = {
  pass: "bg-(--module-scope-feedback-success)",
  fail: "bg-(--module-scope-feedback-danger)",
  unverified: "bg-(--module-scope-context-strong)",
};

export const resultBtnBaseClass =
  "inline-flex items-center gap-1 rounded-full px-1.75 py-0.5 font-(family-name:--font-mono) text-[10.5px] font-[590] tracking-[0.03em] text-(--module-scope-text-tertiary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)";

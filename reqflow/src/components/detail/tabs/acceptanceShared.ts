import type { AcceptanceCriterion, AcceptanceResult } from "../../../types/models";
import { ACCEPTANCE_RESULTS } from "../../../types/models";

export type AcceptancePatch = Partial<Pick<AcceptanceCriterion, "desc" | "result" | "failNote">>;

export const ACCEPTANCE_RESULT_LABEL: Record<AcceptanceResult, string> = Object.fromEntries(
  ACCEPTANCE_RESULTS.map((r) => [r.key, r.label]),
) as Record<AcceptanceResult, string>;

export const ACCEPTANCE_RESULT_ORDER: AcceptanceResult[] = ["pass", "fail", "unverified"];

export const RESULT_BTN_STYLE: Record<AcceptanceResult, string> = {
  pass: "bg-(--st-done-soft) text-(--st-done)",
  fail: "bg-(--st-blocked-soft) text-(--st-blocked)",
  unverified: "bg-(--st-todo-soft) text-(--muted)",
};

export const resultBtnBaseClass =
  "rounded-full px-1.75 py-0.5 font-(family-name:--font-mono) text-[10.5px] font-[590] tracking-[0.03em] text-(--muted-2) hover:bg-(--surface-2)";

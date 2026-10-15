import type { Stage } from "../../../types/models";
import { STAGES } from "../../../types/models";

export const STAGE_LABEL: Record<Stage, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
) as Record<Stage, string>;

export function stageLabelFor(
  stage: Stage,
  closureType: "completed" | "abandoned" | null,
  snapshot: string | undefined,
  stageLabels: Record<string, string>,
): string {
  const label = snapshot ?? stageLabels[stage] ?? STAGE_LABEL[stage] ?? stage;
  return stage === "archive" && closureType === "abandoned" ? `${label}（废弃）` : label;
}

export function fmtDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

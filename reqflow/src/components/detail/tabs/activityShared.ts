import type { Stage } from "../../../types/models";
import { STAGES } from "../../../types/models";

export const STAGE_LABEL: Record<Stage, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
) as Record<Stage, string>;

export function stageLabelFor(stage: Stage, closureType: "completed" | "abandoned" | null): string {
  if (stage === "archive" && closureType === "abandoned") return "归档（废弃）";
  return STAGE_LABEL[stage];
}

export function fmtDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

import type { AcceptanceCriterion } from "../../../types/models";
import { EmptyState } from "../../shared/EmptyState";
import { AcceptanceCard } from "./AcceptanceCard";
import { AcceptanceDraftRow } from "./AcceptanceDraftRow";
import type { AcceptancePatch } from "./acceptanceShared";

interface AcceptanceTabProps {
  acceptance: AcceptanceCriterion[];
  draftOpen: boolean;
  onCreate: (desc: string) => void;
  onCancelDraft: () => void;
  onUpdate: (acceptanceId: string, patch: AcceptancePatch) => void;
  onRemove: (acceptanceId: string) => void;
}

export function AcceptanceTab({ acceptance, draftOpen, onCreate, onCancelDraft, onUpdate, onRemove }: AcceptanceTabProps) {
  if (acceptance.length === 0 && !draftOpen) {
    return <EmptyState text="还没有验收标准，点右上角 + 添加" />;
  }

  const passCount = acceptance.filter((a) => a.result === "pass").length;

  return (
    <div>
      {acceptance.length > 0 && (
        <div className="mb-2.5 font-(family-name:--font-mono) text-[11.5px] text-(--module-scope-text-tertiary)">
          {passCount}/{acceptance.length} 通过
        </div>
      )}
      {draftOpen && <AcceptanceDraftRow onCreate={onCreate} onCancel={onCancelDraft} />}
      {acceptance.map((criterion) => (
        <AcceptanceCard
          key={criterion.id}
          criterion={criterion}
          onUpdate={(patch) => onUpdate(criterion.id, patch)}
          onRemove={() => onRemove(criterion.id)}
        />
      ))}
    </div>
  );
}

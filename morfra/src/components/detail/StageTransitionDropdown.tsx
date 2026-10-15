import type { Stage } from "../../types/models";
import { STAGES } from "../../types/models";

interface StageTransitionDropdownProps {
  currentStage: Stage;
  closureType: "completed" | "abandoned" | null;
  onTransition: (toStage: Stage, opts?: { abandoned?: boolean }) => void;
  className: string;
  style?: React.CSSProperties;
}

const ABANDON_VALUE = "__abandon__";

export function StageTransitionDropdown({
  currentStage,
  closureType,
  onTransition,
  className,
  style,
}: StageTransitionDropdownProps) {
  const currentLabel =
    STAGES.find((s) => s.key === currentStage)?.label ?? currentStage;
  const options = STAGES.filter((s) => s.key !== currentStage);

  return (
    <select
      value=""
      aria-label="流转到其他阶段"
      onChange={(e) => {
        const val = e.target.value;
        if (!val) return;
        if (val === ABANDON_VALUE) onTransition("archive", { abandoned: true });
        else onTransition(val as Stage);
        e.target.value = "";
      }}
      className={className}
      style={style}
    >
      <option value="" disabled hidden>
        {currentLabel}
        {closureType === "abandoned" ? "（废弃）" : ""}
      </option>
      {options.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
      <option value={ABANDON_VALUE}>废弃</option>
    </select>
  );
}

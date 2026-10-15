import { useEffect, useState } from "react";
import { schemaColorWarning, STAGE_PALETTE, validateSchemaColor } from "../../lib/stagePalette";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

/** 预设色板选择器（Product-Spec REQ-025："可自定义颜色，预设色板 8-12 种"，STAGE_PALETTE 固定 8 色）。 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [draftValue, setDraftValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(schemaColorWarning(value));

  useEffect(() => {
    setDraftValue(value);
    setError(null);
    setWarning(schemaColorWarning(value));
  }, [value]);

  function commitManualColor() {
    const next = draftValue.trim().toUpperCase();
    if (next === value.toUpperCase()) {
      setDraftValue(value);
      setError(null);
      setWarning(schemaColorWarning(value));
      return;
    }
    const validation = validateSchemaColor(next);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setDraftValue(next);
    setError(null);
    setWarning(schemaColorWarning(next));
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="选择颜色" className="flex flex-wrap gap-1.5">
        {STAGE_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`颜色 ${color}`}
            aria-pressed={value.toUpperCase() === color.toUpperCase()}
            onClick={() => {
              setDraftValue(color);
              setError(null);
              setWarning(schemaColorWarning(color));
              onChange(color);
            }}
            className={`grid size-6 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent ${
              value.toUpperCase() === color.toUpperCase() ? "ring-1 ring-inset ring-(--module-scope-text-primary)" : "hover:bg-(--module-scope-action-soft)"
            }`}
          >
            <span className="size-3.5 rounded-full" style={{ backgroundColor: color }} />
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[11.5px] text-(--module-scope-text-tertiary)">
        <span className="flex-none">自定义颜色</span>
        <input
          aria-label="自定义颜色"
          value={draftValue}
          onChange={(event) => {
            setDraftValue(event.target.value);
            setError(null);
            setWarning(null);
          }}
          onBlur={commitManualColor}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraftValue(value);
              setError(null);
              setWarning(schemaColorWarning(value));
              event.currentTarget.blur();
            }
          }}
          aria-invalid={Boolean(error)}
          className={`h-7 min-w-0 flex-1 rounded-(--r-sm) border bg-(--module-scope-background-surface) px-2 font-(family-name:--font-mono) text-[11.5px] text-(--module-scope-text-primary) outline-none focus:border-(--module-scope-action-base) ${error ? "border-(--module-scope-feedback-danger)" : "border-(--module-scope-border-subtle)"}`}
        />
      </label>
      {error && <span role="alert" className="text-[11px] text-(--module-scope-feedback-danger)">{error}</span>}
      {warning && <span role="status" aria-live="polite" className="text-[11px] text-(--module-scope-feedback-warning)">{warning}</span>}
    </div>
  );
}

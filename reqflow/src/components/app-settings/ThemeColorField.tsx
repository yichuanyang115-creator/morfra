import type { SemanticToken } from "../../types/theme";

interface ThemeColorFieldProps {
  token: SemanticToken;
  label: string;
  value: string;
  error?: string;
  idPrefix?: string;
  onChange: (value: string) => void;
}

export function ThemeColorField({ token, label, value, error, idPrefix = "theme", onChange }: ThemeColorFieldProps) {
  const inputId = `${idPrefix}-color-${token}`;
  const errorId = `${idPrefix}-error-${token}`;
  return (
    <label className="flex min-h-14 flex-col gap-1.25" htmlFor={inputId}>
      <span className="flex items-center justify-between text-[12.5px] font-[550] text-(--fg)">
        <span>{label}</span>
        <span className="font-(family-name:--font-mono) text-[10.5px] text-(--muted-2)">{token}</span>
      </span>
      <input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        placeholder="如 #3F7A02 或 green600"
        className={
          "h-8 rounded-(--r-sm) border bg-(--surface) px-2.5 font-(family-name:--font-mono) text-[12px] text-(--fg) outline-none focus:border-(--accent) " +
          (error ? "border-(--st-blocked)" : "border-(--border-strong)")
        }
      />
      {error && <span id={errorId} className="text-[11px] text-(--st-blocked)">{error}</span>}
    </label>
  );
}

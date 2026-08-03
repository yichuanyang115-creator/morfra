import { STAGE_PALETTE } from "../../lib/stagePalette";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

/** 预设色板选择器（Product-Spec REQ-025："可自定义颜色，预设色板 8-12 种"，STAGE_PALETTE 固定 8 色）。 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div role="group" aria-label="选择颜色" className="flex flex-wrap gap-1.5">
      {STAGE_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`颜色 ${color}`}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          style={{ backgroundColor: color }}
          className={`size-6 flex-none rounded-(--r-sm) border-2 ${
            value === color ? "border-(--fg)" : "border-transparent hover:border-(--border-strong)"
          }`}
        />
      ))}
    </div>
  );
}

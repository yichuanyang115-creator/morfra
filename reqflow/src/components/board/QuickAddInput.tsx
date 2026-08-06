import { useState } from "react";
import type { Attribute } from "../../types/schema";
import { BOARD_COLUMN_GAP, gridTemplateColumnsFor } from "../../lib/boardWidth";

interface QuickAddInputProps {
  placeholder: string;
  /** 已按 schema 可见属性顺序排好的属性列表，用于生成和需求行一致的 grid 列数。 */
  attributes: Attribute[];
  /** 用户拖拽调整过的列宽，需要跟表头/需求行用同一份值才能保持列对齐（见 BoardHeader.tsx）。 */
  columnWidths: Record<string, number>;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function QuickAddInput({ placeholder, attributes, columnWidths, onSubmit, onCancel }: QuickAddInputProps) {
  const [value, setValue] = useState("");
  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
    else onCancel();
  };

  return (
    <div
      className="grid w-fit min-w-full items-center border-b border-(--border) bg-(--accent-soft) px-2 py-2"
      style={{ gridTemplateColumns: gridTemplateColumnsFor(attributes, columnWidths), columnGap: BOARD_COLUMN_GAP }}
    >
      <input
        type="text"
        autoFocus
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onCancel();
          } else if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="sticky left-0 w-full border-none bg-transparent pl-5.5 font-(family-name:--font-body) text-[13px] text-(--fg) outline-none placeholder:text-(--muted-2)"
      />
    </div>
  );
}

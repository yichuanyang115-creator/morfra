import { useState } from "react";
import type { Attribute } from "../../types/schema";
import { gridTemplateColumnsFor } from "../../lib/boardWidth";

interface QuickAddInputProps {
  placeholder: string;
  /** 已按 schema 可见属性顺序排好的属性列表，用于生成和需求行一致的 grid 列数。 */
  attributes: Attribute[];
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function QuickAddInput({ placeholder, attributes, onSubmit, onCancel }: QuickAddInputProps) {
  const [value, setValue] = useState("");

  return (
    <div
      className="grid w-fit min-w-full items-center gap-3 border-b border-(--border) bg-(--accent-soft) px-2 py-2"
      style={{ gridTemplateColumns: gridTemplateColumnsFor(attributes) }}
    >
      <input
        type="text"
        autoFocus
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={() => {
          if (!value.trim()) onCancel();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onCancel();
          } else if (e.key === "Enter") {
            const trimmed = value.trim();
            if (trimmed) onSubmit(trimmed);
          }
        }}
        className="sticky left-0 w-full border-none bg-transparent font-(family-name:--font-body) text-[13px] text-(--fg) outline-none placeholder:text-(--muted-2)"
      />
    </div>
  );
}

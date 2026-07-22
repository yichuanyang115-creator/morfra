import { useState } from "react";

interface QuickAddInputProps {
  placeholder: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function QuickAddInput({ placeholder, onSubmit, onCancel }: QuickAddInputProps) {
  const [value, setValue] = useState("");

  return (
    <div
      className="grid max-w-(--board-row-max-w) items-center gap-3 border-b border-(--border) bg-(--accent-soft) px-2 py-2"
      style={{ gridTemplateColumns: "minmax(140px, 320px) 40px 56px 56px 52px 56px 56px 40px" }}
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
        className="w-full border-none bg-transparent font-(family-name:--font-body) text-[13px] text-(--fg) outline-none placeholder:text-(--muted-2)"
      />
    </div>
  );
}

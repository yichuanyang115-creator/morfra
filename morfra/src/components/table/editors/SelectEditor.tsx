import { useEffect, useRef } from "react";
import type { FieldSummary } from "../../../types/domain";

interface SelectEditorProps {
  field: FieldSummary;
  value: string | string[] | null;
  onChange: (value: string | string[]) => void;
  onCommit: (value: string | string[] | null, direction?: "left" | "right" | "up" | "down") => void;
  onCancel: () => void;
}

export function SelectEditor({ field, value, onChange, onCommit, onCancel }: SelectEditorProps) {
  const selected = Array.isArray(value) ? value : [];
  const multi = field.fieldType === "multi_select";
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => hostRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), []);
  return <div ref={hostRef} className="morfra-grid-select-editor" role="dialog" aria-label={`编辑${field.name}`} onKeyDown={(event) => { event.stopPropagation(); const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")]; if (event.key === "Escape") { event.preventDefault(); onCancel(); return; } if (event.key === "Enter") { event.preventDefault(); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); const nextValue = multi ? selected : index <= 0 ? null : field.options[index - 1]?.id ?? value; onCommit(nextValue, event.shiftKey ? "up" : "down"); return; } if (event.key === "Tab") { event.preventDefault(); onCommit(multi ? selected : value, event.shiftKey ? "left" : "right"); return; } if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); } }}>
    <button type="button" className="morfra-grid-option" aria-pressed={multi ? selected.length === 0 : value === null} onClick={() => { if (multi) { onChange([]); return; } onCommit(null); }}>{multi ? "清空选择" : "未选择"}</button>
    {field.options.map((option) => {
      const active = multi ? selected.includes(option.id) : value === option.id;
      return <button key={option.id} type="button" className="morfra-grid-option" aria-pressed={active} onClick={() => {
        if (!multi) { onCommit(option.id); return; }
        onChange(active ? selected.filter((id) => id !== option.id) : [...selected, option.id]);
      }}>{multi && <span aria-hidden="true">{active ? "✓" : ""}</span>}{option.name}</button>;
    })}
    {multi && <p>按 Return 或点击其他单元格提交</p>}
  </div>;
}

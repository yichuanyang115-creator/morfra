import { useEffect, useRef } from "react";

interface DateEditorProps {
  value: string;
  includeTime: boolean;
  label: string;
  onChange: (value: string) => void;
  onCommit: (direction?: "left" | "right" | "up" | "down") => void;
  onCancel: () => void;
}

export function DateEditor({ value, includeTime, label, onChange, onCommit, onCancel }: DateEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  return <input ref={inputRef} className="morfra-grid-editor-input" aria-label={label} type={includeTime ? "datetime-local" : "date"} value={value} onChange={(event) => { onChange(event.target.value); if (event.target.value) onCommit(); }} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); onCancel(); return; } if (event.key === "Enter") { event.preventDefault(); onCommit(event.shiftKey ? "up" : "down"); return; } if (event.key === "Tab") { event.preventDefault(); onCommit(event.shiftKey ? "left" : "right"); } }} />;
}

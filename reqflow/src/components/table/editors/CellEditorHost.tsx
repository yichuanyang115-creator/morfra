import { useEffect, useRef } from "react";
import type { FieldSummary, JsonValue } from "../../../types/domain";
import { DateEditor } from "./DateEditor";
import { SelectEditor } from "./SelectEditor";

interface CellEditorHostProps {
  field: FieldSummary;
  value: JsonValue;
  label: string;
  error: string | null;
  onChange: (value: JsonValue) => void;
  onCommit: (direction?: "left" | "right" | "up" | "down") => void;
  onCancel: () => void;
}

export function CellEditorHost({ field, value, label, error, onChange, onCommit, onCancel }: CellEditorHostProps) {
  if (field.fieldType === "select" || field.fieldType === "multi_select") return <SelectEditor field={field} value={Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" ? value : null} onChange={onChange} onCommit={(next, direction) => { onChange(next); onCommit(direction); }} onCancel={onCancel} />;
  if (field.fieldType === "date") return <DateEditor value={typeof value === "string" ? value : ""} includeTime={configBoolean(field, "includeTime")} label={label} onChange={onChange} onCommit={onCommit} onCancel={onCancel} />;
  if (field.fieldType === "checkbox") return <button type="button" className="morfra-grid-checkbox-editor" aria-label={label} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); onCancel(); return; } if (event.key === "Enter") { event.preventDefault(); onCommit(event.shiftKey ? "up" : "down"); return; } if (event.key === "Tab") { event.preventDefault(); onCommit(event.shiftKey ? "left" : "right"); } }} onClick={() => { onChange(value !== true); onCommit(); }}>{value === true ? "已勾选" : "未勾选"}</button>;
  return <TextEditor field={field} value={value} label={label} error={error} onChange={onChange} onCommit={onCommit} onCancel={onCancel} />;
}

function TextEditor({ field, value, label, error, onChange, onCommit, onCancel }: CellEditorHostProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const raw = value === null ? "" : typeof value === "string" || typeof value === "number" ? String(value) : "";
  const multiline = field.fieldType === "text" && configBoolean(field, "multiline");
  const type = field.fieldType === "number" || field.fieldType === "progress" ? "number" : field.fieldType === "image" || field.fieldType === "file" || field.fieldType === "link" ? "url" : "text";
  useEffect(() => { const input = multiline ? textareaRef.current : inputRef.current; input?.focus(); }, [multiline]);
  const keyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
    if (event.key === "Enter") { event.preventDefault(); onCommit(event.shiftKey ? "up" : "down"); return; }
    if (event.key === "Tab") { event.preventDefault(); onCommit(event.shiftKey ? "left" : "right"); }
  };
  const className = `morfra-grid-editor-input ${error ? "is-error" : ""}`;
  if (multiline) return <textarea ref={textareaRef} className={className} aria-label={label} aria-invalid={Boolean(error)} value={raw} onChange={(event) => onChange(event.target.value)} onKeyDown={keyDown} rows={2} />;
  return <input ref={inputRef} className={className} aria-label={label} aria-invalid={Boolean(error)} value={raw} onChange={(event) => onChange(event.target.value)} onKeyDown={keyDown} type={type} min={field.fieldType === "progress" ? 0 : undefined} max={field.fieldType === "progress" ? 100 : undefined} />;
}

function configBoolean(field: FieldSummary, key: string): boolean {
  return typeof field.config === "object" && field.config !== null && !Array.isArray(field.config) && field.config[key] === true;
}

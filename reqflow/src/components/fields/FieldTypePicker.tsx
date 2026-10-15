import { useEffect, useRef, useState } from "react";
import type { FieldType } from "../../types/domain";
import { FIELD_TYPE_LABELS, FieldTypeIcon } from "./FieldTypeIcon";
import { CREATABLE_FIELD_TYPES, defaultFieldName } from "./fieldCreation";

interface FieldTypePickerProps {
  onCreate: (fieldType: FieldType, name: string) => Promise<void>;
  onClose: () => void;
  inline?: boolean;
}

export function FieldTypePicker({ onCreate, onClose, inline = false }: FieldTypePickerProps) {
  const [creating, setCreating] = useState<FieldType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (creating) return;
    const closeOutside = (event: PointerEvent) => { if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) onClose(); };
    document.addEventListener("pointerdown", closeOutside, true);
    window.addEventListener("blur", onClose);
    return () => { document.removeEventListener("pointerdown", closeOutside, true); window.removeEventListener("blur", onClose); };
  }, [creating, onClose]);
  async function choose(fieldType: FieldType) {
    if (creating) return;
    try { setCreating(fieldType); setError(null); await onCreate(fieldType, defaultFieldName(fieldType)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "新建字段失败，请重试"); setCreating(null); }
  }
  return <div ref={pickerRef} className={`morfra-field-type-picker${inline ? " is-inline" : ""}`} role="dialog" aria-label="选择字段类型" aria-describedby={error ? "field-type-picker-error" : undefined} onBlur={(event) => { const nextTarget = event.relatedTarget; if (!creating && (!nextTarget || !event.currentTarget.contains(nextTarget))) onClose(); }} onKeyDown={(event) => { if (event.key === "Escape" && !creating) onClose(); }}>
    <div className="morfra-field-type-picker-heading"><span>选择字段类型</span><button type="button" aria-label="关闭字段类型选择器" onClick={onClose} disabled={Boolean(creating)}>×</button></div>
    <div className="morfra-field-type-picker-options" role="listbox" aria-label="字段类型">
      {CREATABLE_FIELD_TYPES.map((fieldType) => <button key={fieldType} type="button" role="option" aria-selected={creating === fieldType} disabled={Boolean(creating)} onClick={() => void choose(fieldType)}><FieldTypeIcon type={fieldType} /><span>{FIELD_TYPE_LABELS[fieldType]}</span>{creating === fieldType && <span aria-label="正在创建">…</span>}</button>)}
    </div>
    {error && <p id="field-type-picker-error" role="alert">{error}</p>}
  </div>;
}

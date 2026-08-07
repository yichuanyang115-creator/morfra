import { useEffect, useState } from "react";
import type { TabField } from "../../../types/schema";
import type { TabRecord } from "../../../types/models";

interface GenericCardProps {
  record: TabRecord;
  fields: TabField[];
  onUpdate: (values: Record<string, unknown>) => void;
  onRemove: () => void;
}

function displayValue(field: TabField, value: unknown): string {
  if (field.type === "multiSelect" && Array.isArray(value)) return value.join("、");
  const option = field.options?.find((item) => item.id === value);
  return option?.label ?? (value == null || value === "" ? "未填写" : String(value));
}

export function GenericCard({ record, fields, onUpdate, onRemove }: GenericCardProps) {
  const [values, setValues] = useState(record.fieldValues);
  useEffect(() => setValues(record.fieldValues), [record.fieldValues]);

  function commit(fieldId: string, value: unknown) {
    const next = { ...values, [fieldId]: value };
    setValues(next);
    onUpdate(next);
  }

  return (
    <div className="mb-1.5 rounded-(--r-md) border border-(--module-scope-border-subtle) p-2.25 last:mb-0">
      <div className="flex items-center justify-end">
        <button type="button" aria-label="删除记录" onClick={onRemove} className="rounded-(--r-sm) px-2 py-1 text-[11px] text-(--module-scope-text-tertiary) hover:bg-(--module-scope-feedback-danger-soft) hover:text-(--module-scope-feedback-danger)">
          删除
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {fields.map((field) => {
          const value = values[field.id];
          if (field.type === "checkbox") {
            return <label key={field.id} className="flex items-center gap-2 text-[12.5px] text-(--module-scope-text-primary)"><input type="checkbox" checked={value === true} onChange={(event) => commit(field.id, event.target.checked)} />{field.name}</label>;
          }
          if (field.type === "singleSelect") {
            return <label key={field.id} className="flex flex-col gap-1 text-[11px] text-(--module-scope-text-tertiary)">{field.name}<select value={typeof value === "string" ? value : ""} onChange={(event) => commit(field.id, event.target.value)} className="rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1.5 text-[12.5px] text-(--module-scope-text-primary)"><option value="">未选择</option>{field.options?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;
          }
          return <label key={field.id} className="flex flex-col gap-1 text-[11px] text-(--module-scope-text-tertiary)">{field.name}<input type={field.type === "date" ? "date" : field.type === "number" || field.type === "percent" ? "number" : "text"} value={typeof value === "string" || typeof value === "number" ? value : ""} placeholder={displayValue(field, value)} onChange={(event) => commit(field.id, field.type === "number" || field.type === "percent" ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value)} className="rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1.5 text-[12.5px] text-(--module-scope-text-primary)" /></label>;
        })}
      </div>
    </div>
  );
}

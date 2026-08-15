import { useEffect, useState } from "react";
import type { FieldOptionSummary, FieldSummary, FieldType, JsonValue } from "../../types/domain";
import { OptionEditor } from "./OptionEditor";
import { FIELD_TYPE_LABELS } from "./FieldTypeIcon";

interface Props {
  field: FieldSummary;
  error: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  onBack: () => void;
  onSave: (field: FieldSummary, type: FieldType, config: JsonValue) => Promise<boolean>;
  onCreateOption: (fieldId: string, name: string, color?: string) => Promise<void>;
  onUpdateOption: (option: FieldOptionSummary, name: string, color: string) => Promise<void>;
  onDeleteOption: (option: FieldOptionSummary) => Promise<void>;
  onReorderOption: (fieldId: string, optionIds: string[]) => Promise<void>;
}

export function FieldEditPage({ field, error, onBack, onSave, onCreateOption, onUpdateOption, onDeleteOption, onReorderOption }: Props) {
  const [type, setType] = useState(field.fieldType);
  const [config, setConfig] = useState<JsonValue>(field.config);
  const control = "h-8 min-w-0 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-canvas) px-2 text-[12px]";

  useEffect(() => { setType(field.fieldType); setConfig(field.config); }, [field]);

  async function apply(nextType: FieldType, nextConfig: JsonValue) {
    const applied = await onSave(field, nextType, nextConfig);
    if (!applied) { setType(field.fieldType); setConfig(field.config); return; }
    setType(nextType); setConfig(nextConfig);
  }

  function changeConfig(key: string, next: JsonValue) {
    const current = config && typeof config === "object" && !Array.isArray(config) ? config : {};
    void apply(type, { ...current, [key]: next });
  }

  return <>
    <header className="flex items-center border-b border-(--module-scope-border-subtle) px-3 py-2"><h2 id="field-manager-title" className="sr-only">字段设置</h2><button type="button" aria-label="返回字段列表" title="返回字段列表" className="grid size-7 place-items-center rounded-(--r-sm) text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-text-primary)" onClick={onBack}><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9.5 3.5-4 4 4 4" /></svg></button></header>
    <div className="min-h-0 flex-1 overflow-y-auto p-3"><div className="grid gap-2">
      <select aria-label="字段类型" disabled={field.isTitle} className={control} value={type} onChange={(event) => void apply(event.target.value as FieldType, config)}>{(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((key) => <option key={key} value={key}>{FIELD_TYPE_LABELS[key]}</option>)}</select>
      {type === "number" && <select aria-label="数字格式" className={control} value={value(config, "format") as string ?? "number"} onChange={(event) => changeConfig("format", event.target.value)}><option value="number">普通数字</option><option value="percent">百分数</option><option value="currency">货币</option></select>}
      {type === "text" && <Toggle label="支持多行显示" checked={value(config, "multiline") === true} onChange={(next) => changeConfig("multiline", next)} />}
      {type === "date" && <Toggle label="包含具体时间" checked={value(config, "includeTime") === true} onChange={(next) => changeConfig("includeTime", next)} />}
      {(type === "select" || type === "multi_select") && <Toggle label="填写时允许新增选项" checked={value(config, "allowCreate") !== false} onChange={(next) => changeConfig("allowCreate", next)} />}
      {(type === "select" || type === "multi_select") && <OptionEditor options={field.options} onCreate={(name, color) => onCreateOption(field.id, name, color)} onUpdate={onUpdateOption} onDelete={onDeleteOption} onReorder={(ids) => onReorderOption(field.id, ids)} />}
    </div>{error && <p role="alert">{error}</p>}</div>
  </>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) { return <label>{label}<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>; }
function value(config: JsonValue, key: string): JsonValue | undefined { return config && typeof config === "object" && !Array.isArray(config) ? config[key] : undefined; }

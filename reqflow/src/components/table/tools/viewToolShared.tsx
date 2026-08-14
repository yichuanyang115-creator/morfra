import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { FieldSummary, JsonValue } from "../../../types/domain";
import { filterOperatorsFor, type FilterOperator, type ViewFilter, type ViewPipelineConfig } from "../../../lib/table/viewPipeline";

export interface PanelProps {
  fields: FieldSummary[];
  config: ViewPipelineConfig;
  onChange: (config: ViewPipelineConfig) => void;
  onClose: () => void;
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: "包含", notContains: "不包含", equals: "等于", notEquals: "不等于", isEmpty: "为空", isNotEmpty: "不为空",
  greaterThan: "大于", greaterOrEqual: "大于等于", lessThan: "小于", lessOrEqual: "小于等于", between: "介于",
  before: "早于", after: "晚于", on: "当天", dateBetween: "日期区间", isChecked: "已勾选", isUnchecked: "未勾选",
  hasFiles: "有附件", fileNameContains: "文件名包含", fileCountEquals: "附件数等于", fileCountGreaterThan: "附件数大于", fileCountLessThan: "附件数小于",
};

export function Panel({ title, onClose, children, wide = false, anchor }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; anchor?: HTMLElement | null }) {
  const panelRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<CSSProperties | undefined>();
  useEffect(() => { panelRef.current?.querySelector<HTMLElement>("input, select, button:not([disabled])")?.focus(); }, []);
  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(wide ? 460 : 340, window.innerWidth - 24);
      setPosition({ position: "fixed", zIndex: 1000, top: rect.bottom + 6, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width });
    };
    place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor, wide]);
  const panel = <section ref={panelRef} style={position} className={`morfra-view-tool-panel${wide ? " is-wide" : ""}${anchor ? " is-portal" : ""}`} role="dialog" aria-label={title} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
    <header><h2>{title}</h2></header>
    {children}
  </section>;
  return anchor && typeof document !== "undefined" ? createPortal(panel, document.body) : panel;
}

export function ConditionRow({ fields, condition, onChange, onRemove }: { fields: FieldSummary[]; condition: ViewFilter; onChange: (value: ViewFilter) => void; onRemove: () => void }) {
  const field = fields.find((item) => item.id === condition.fieldId) ?? fields[0];
  const operators = operatorsFor(field);
  return <div className="morfra-view-tool-row">
    <select aria-label="筛选字段" value={condition.fieldId} onChange={(event) => {
      const nextField = fields.find((item) => item.id === event.target.value);
      onChange({ ...condition, fieldId: event.target.value, operator: operatorsFor(nextField)[0] ?? "equals", value: "" });
    }}>{fieldOptions(fields)}</select>
    <select aria-label="筛选条件" value={condition.operator} onChange={(event) => onChange({ ...condition, operator: event.target.value as FilterOperator })}>{operatorOptions(operators, field)}</select>
    <ConditionValue field={field} operator={condition.operator} value={condition.value} label="筛选值" onChange={(value) => onChange({ ...condition, value })} />
    <button type="button" aria-label="删除筛选条件" onClick={onRemove}>×</button>
  </div>;
}

export function ConditionValue({ field, operator, value, label, onChange }: { field?: FieldSummary; operator: FilterOperator; value: JsonValue | undefined; label: string; onChange: (value: JsonValue) => void }) {
  if (["isEmpty", "isNotEmpty", "isChecked", "isUnchecked", "hasFiles"].includes(operator)) return null;
  if (operator === "between" || operator === "dateBetween") {
    const [start = "", end = ""] = Array.isArray(value) ? value.map(String) : ["", ""];
    const type = operator === "dateBetween" ? "date" : "number";
    return <><input type={type} aria-label={`${label}起始`} value={start} onChange={(event) => onChange([event.target.value, end])} /><input type={type} aria-label={`${label}结束`} value={end} onChange={(event) => onChange([start, event.target.value])} /></>;
  }
  if (field && ["select", "multi_select"].includes(field.fieldType)) return <select aria-label={label} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
    <option value="">请选择</option>{field.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
  </select>;
  const type = operator.startsWith("fileCount") || field && ["number", "progress", "auto_number"].includes(field.fieldType) ? "number" : field && ["date", "created_time", "updated_time"].includes(field.fieldType) ? "date" : "text";
  return <input type={type} aria-label={label} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />;
}

export function fieldOptions(fields: FieldSummary[]) { return fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>); }
export function replace<T>(items: T[], index: number, value: T): T[] { return items.map((item, itemIndex) => itemIndex === index ? value : item); }
export function move<T>(items: T[], from: number, to: number): T[] { const next = [...items]; const [item] = next.splice(from, 1); if (item !== undefined) next.splice(to, 0, item); return next; }
export function newId() { return `view-rule-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export const operatorsFor = filterOperatorsFor;
export function operatorLabel(operator: FilterOperator, field?: FieldSummary) { return operator === "equals" && ["select", "date", "created_time", "updated_time"].includes(field?.fieldType ?? "") ? "是" : operator === "notEquals" && ["select", "date", "created_time", "updated_time"].includes(field?.fieldType ?? "") ? "不是" : OPERATOR_LABELS[operator]; }
export function operatorOptions(operators: FilterOperator[], field?: FieldSummary) { return operators.map((operator) => <option key={operator} value={operator}>{operatorLabel(operator, field)}</option>); }
export function fieldTypeIcon(field: FieldSummary) { return ({ text: "T", number: "#", progress: "%", select: "⌄", multi_select: "≡", date: "◷", checkbox: "☑", link: "↗", image: "▧", file: "▤", auto_number: "#", created_time: "◷", updated_time: "◷" } as const)[field.fieldType]; }

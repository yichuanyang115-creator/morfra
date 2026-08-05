import type { Attribute, FilterCondition, FilterOperator } from "../../types/schema";
import { operatorsFor } from "../../lib/filterEngine";

const OPERATOR_LABEL: Record<FilterOperator, string> = {
  eq: "=",
  neq: "≠",
  is_empty: "为空",
  is_not_empty: "不为空",
  contains: "包含",
  not_contains: "不包含",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  before: "之前",
  after: "之后",
};

const selectClass =
  "min-w-0 flex-1 rounded-(--r-sm) border border-(--border) bg-(--surface) px-1.5 py-1 text-[12px] text-(--fg) outline-none";
const inputClass =
  "min-w-0 flex-1 rounded-(--r-sm) border border-(--border) bg-(--surface) px-1.5 py-1 font-(family-name:--font-body) text-[12px] text-(--fg) outline-none focus:border-(--accent)";
const disabledSelectClass = "disabled:cursor-not-allowed disabled:opacity-40";

function CloseIcon() {
  return (
    <svg className="size-3" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface FilterConditionRowProps {
  condition: FilterCondition;
  /** 全部可筛属性（REQ-026："可筛选范围：所有属性类型，无排除"）。 */
  attributes: Attribute[];
  onChange: (condition: FilterCondition) => void;
  onRemove: () => void;
}

/**
 * 单条筛选条件行：选属性 → 选运算符（按属性类型过滤）→ 选值（按运算符渲染控件，空值
 * 运算符不渲染取值控件）。换属性/运算符时重置 value——运算符语义变了，旧值类型可能不匹配
 * （如单选 optionId 换到数字比较）。编辑即 onChange 上抛落盘（REQ-026 编辑即生效）。
 */
export function FilterConditionRow({ condition, attributes, onChange, onRemove }: FilterConditionRowProps) {
  const attribute = attributes.find((a) => a.id === condition.attributeId);
  const operators = attribute ? operatorsFor(attribute) : [];

  function selectAttribute(attributeId: string) {
    const next = attributes.find((a) => a.id === attributeId);
    onChange({ attributeId, operator: next ? operatorsFor(next)[0] ?? "eq" : "eq", value: "" });
  }

  function selectOperator(operator: FilterOperator) {
    onChange({ ...condition, operator, value: "" });
  }

  function setValue(value: unknown) {
    onChange({ ...condition, value });
  }

  function renderValueControl() {
    if (!attribute) return null;
    const op = condition.operator;

    if (op === "is_empty" || op === "is_not_empty") return null; // 不需要取值

    if (op === "contains" || op === "not_contains") {
      if (attribute.type === "multiSelect") {
        return (
          <select
            value={typeof condition.value === "string" ? condition.value : ""}
            aria-label="筛选取值"
            onChange={(e) => setValue(e.target.value)}
            className={`${selectClass} ${disabledSelectClass}`}
          >
            <option value="">选择选项</option>
            {(attribute.options ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      return (
        <input
          type="text"
          aria-label="筛选取值"
          defaultValue={typeof condition.value === "string" ? condition.value : ""}
          onBlur={(e) => setValue(e.target.value)}
          className={inputClass}
        />
      );
    }

    if (op === "eq" || op === "neq") {
      if (attribute.type === "checkbox") {
        return (
          <select
            value={condition.value === true ? "true" : condition.value === false ? "false" : ""}
            aria-label="筛选取值"
            onChange={(e) => setValue(e.target.value === "true")}
            className={`${selectClass} ${disabledSelectClass}`}
          >
            <option value="">选择</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        );
      }
      if (attribute.type === "singleSelect") {
        return (
          <select
            value={typeof condition.value === "string" ? condition.value : ""}
            aria-label="筛选取值"
            onChange={(e) => setValue(e.target.value)}
            className={`${selectClass} ${disabledSelectClass}`}
          >
            <option value="">选择选项</option>
            {(attribute.options ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      if (attribute.type === "number" || attribute.type === "percent") {
        return (
          <input
            type="number"
            aria-label="筛选取值"
            defaultValue={typeof condition.value === "number" ? String(condition.value) : ""}
            onBlur={(e) => {
              const n = Number.parseFloat(e.target.value);
              if (!Number.isNaN(n)) setValue(n);
            }}
            className={inputClass}
          />
        );
      }
      if (attribute.type === "date") {
        return (
          <input
            type="date"
            aria-label="筛选取值"
            defaultValue={typeof condition.value === "string" ? condition.value : ""}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
          />
        );
      }
    }

    if (op === "gt" || op === "gte" || op === "lt" || op === "lte") {
      return (
        <input
          type="number"
          aria-label="筛选取值"
          defaultValue={typeof condition.value === "number" ? String(condition.value) : ""}
          onBlur={(e) => {
            const n = Number.parseFloat(e.target.value);
            if (!Number.isNaN(n)) setValue(n);
          }}
          className={inputClass}
        />
      );
    }

    if (op === "before" || op === "after") {
      return (
        <input
          type="date"
          aria-label="筛选取值"
          defaultValue={typeof condition.value === "string" ? condition.value : ""}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
        />
      );
    }

    // 兜底：文本输入
    return (
      <input
        type="text"
        aria-label="筛选取值"
        defaultValue={typeof condition.value === "string" ? condition.value : ""}
        onBlur={(e) => setValue(e.target.value)}
        className={inputClass}
      />
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select value={condition.attributeId} aria-label="筛选属性" onChange={(e) => selectAttribute(e.target.value)} className={selectClass}>
        <option value="">选择属性</option>
        {attributes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <select
        value={condition.operator}
        aria-label="筛选运算符"
        disabled={!attribute}
        onChange={(e) => selectOperator(e.target.value as FilterOperator)}
        className="flex-none rounded-(--r-sm) border border-(--border) bg-(--surface) px-1.5 py-1 text-[12px] text-(--fg) outline-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        {operators.map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABEL[op]}
          </option>
        ))}
      </select>
      {renderValueControl()}
      <button
        type="button"
        aria-label="删除该筛选条件"
        onClick={onRemove}
        className="grid size-6 flex-none place-items-center rounded-(--r-sm) text-(--muted-2) hover:bg-(--st-blocked-soft) hover:text-(--st-blocked)"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

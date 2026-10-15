import type { Attribute } from "../../types/schema";

const textInputClass =
  "w-full rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1.5 font-(family-name:--font-body) text-[13px] text-(--module-scope-text-primary) outline-none focus:border-(--module-scope-action-base)";
const selectClass =
  "min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-1.5 py-1 text-[12px] text-(--module-scope-text-primary) outline-none";

/**
 * 依赖取值控件：按依赖源属性类型渲染对应输入，写入与属性值类型一致的 value——
 * singleSelect/multiSelect 存 optionId、number/percent 存 number、checkbox 存 boolean、
 * date/text 存 string。依赖引擎（dependencySatisfied）按严格相等（多选为包含）求值，
 * 类型不一致会导致条件永远不满足（如 number 存字符串 vs 属性值 number）。
 *
 * 调用方需传 key={dependsOn.attributeId}：非受控输入（defaultValue）在依赖源同类型间
 * 切换时 React 复用 DOM 实例不更新 defaultValue，加 key 强制重挂载避免展示陈旧值。
 */
export function DependencyValueControl({
  source,
  value,
  onChange,
}: {
  source: Attribute | undefined;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const disabled = !source;

  if (source?.type === "singleSelect" || source?.type === "multiSelect") {
    const options = source.options ?? [];
    return (
      <select
        value={typeof value === "string" ? value : ""}
        aria-label="依赖取值"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <option value="">选择取值</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (source?.type === "number" || source?.type === "percent") {
    return (
      <input
        type="number"
        aria-label="依赖取值"
        disabled={disabled}
        defaultValue={typeof value === "number" ? String(value) : ""}
        onBlur={(e) => {
          const n = Number.parseFloat(e.target.value);
          // 空/非法输入不下发，保留原依赖值，避免把条件意外改成一串永假的空值
          if (!Number.isNaN(n)) onChange(n);
        }}
        className={`${textInputClass} flex-1 disabled:cursor-not-allowed disabled:opacity-40`}
      />
    );
  }

  if (source?.type === "checkbox") {
    return (
      <input
        type="checkbox"
        aria-label="依赖取值"
        disabled={disabled}
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 flex-none disabled:cursor-not-allowed disabled:opacity-40"
      />
    );
  }

  if (source?.type === "date") {
    return (
      <input
        type="date"
        aria-label="依赖取值"
        disabled={disabled}
        defaultValue={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className={`${textInputClass} flex-1 disabled:cursor-not-allowed disabled:opacity-40`}
      />
    );
  }

  // text / attachment / computed 依赖源：文本值，失焦保存（保持原行为，不频繁写盘）
  return (
    <input
      type="text"
      aria-label="依赖取值"
      disabled={disabled}
      defaultValue={typeof value === "string" ? value : ""}
      onBlur={(e) => onChange(e.target.value)}
      className={`${textInputClass} flex-1 disabled:cursor-not-allowed disabled:opacity-40`}
    />
  );
}

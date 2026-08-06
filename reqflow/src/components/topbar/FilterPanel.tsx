import { useEffect } from "react";
import type { Attribute, FilterCondition } from "../../types/schema";
import { FilterConditionRow } from "./FilterConditionRow";

function PlusIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface FilterPanelProps {
  /** 全部可筛属性（REQ-026："可筛选范围：所有属性类型，无排除"）。 */
  attributes: Attribute[];
  /** 当前筛选条件集合（写 viewPreferences.filters）。 */
  filters: FilterCondition[];
  /** 编辑即上抛完整新集合，调用方落盘（REQ-026 编辑即生效，Design-Brief 自动保存）。 */
  onChange: (filters: FilterCondition[]) => void;
  onClose: () => void;
}

/**
 * 顶栏"筛选"按钮弹出的筛选下拉面板（REQ-026：条件结构 选属性→选运算符→选值，多条件 AND，
 * 底部"+ 添加条件"）。浮层样式对齐 FieldsPanel/SettingsPanel。点击外部由 Topbar 遮罩关闭，
 * Esc 在这里兜底。
 */
export function FilterPanel({ attributes, filters, onChange, onClose }: FilterPanelProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function updateAt(index: number, condition: FilterCondition) {
    onChange(filters.map((c, i) => (i === index ? condition : c)));
  }

  function removeAt(index: number) {
    onChange(filters.filter((_, i) => i !== index));
  }

  function addCondition() {
    onChange([...filters, { attributeId: "", operator: "eq", value: "" }]);
  }

  return (
    <div
      className="fixed right-3 z-50 w-72 rounded-(--r-lg) border border-(--border-strong) bg-(--surface) p-3.5 shadow-[0_12px_32px_-8px_rgba(30,40,70,0.18),0_2px_8px_rgba(30,40,70,0.05)]"
      style={{ top: "calc(var(--topbar-h) + 6px)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-(family-name:--font-display) text-[13px] font-[590] text-(--fg)">筛选</span>
      </div>

      {filters.length === 0 ? (
        <p className="m-0 py-2 text-center text-[12px] text-(--muted-2)">还没有筛选条件</p>
      ) : (
        <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto border-t border-(--border) pt-1.5">
          {filters.map((condition, index) => (
            <FilterConditionRow
              key={index}
              condition={condition}
              attributes={attributes}
              onChange={(next) => updateAt(index, next)}
              onRemove={() => removeAt(index)}
            />
          ))}
        </div>
      )}

      <div className="mt-2.5 border-t border-(--border) pt-2">
        <button
          type="button"
          onClick={addCondition}
          className="inline-flex w-full items-center gap-1.5 rounded-(--r-sm) border-none bg-transparent px-1.5 py-1 text-[12px] font-[550] text-(--accent-text) hover:bg-(--accent-soft)"
        >
          <PlusIcon />
          添加条件
        </button>
      </div>
    </div>
  );
}

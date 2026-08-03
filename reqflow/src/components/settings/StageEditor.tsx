import { useState } from "react";
import type { Attribute, AttributeOverride, StageOption } from "../../types/schema";
import { ColorPicker } from "./ColorPicker";

interface StageEditorProps {
  stageOption: StageOption;
  /** 全部用户可创建属性（骨架属性 Name/Stage 不参与覆盖，见 Schema-自定义机制-讨论稿 §4.2）。 */
  availableAttributes: Attribute[];
  onUpdate: (patch: Partial<StageOption>) => void;
}

const fieldLabelClass = "block mb-1 text-[11.5px] text-(--muted-2)";
const textInputClass =
  "w-full rounded-(--r-sm) border border-(--border) bg-(--surface) px-2 py-1.5 font-(family-name:--font-body) text-[13px] text-(--fg) outline-none focus:border-(--accent)";
const selectClass =
  "min-w-0 flex-1 rounded-(--r-sm) border border-(--border) bg-(--surface) px-1.5 py-1 text-[12px] text-(--fg) outline-none";

function CloseIcon() {
  return (
    <svg className="size-3" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function AttributeOverrideRow({
  override,
  availableAttributes,
  onChange,
  onRemove,
}: {
  override: AttributeOverride;
  availableAttributes: Attribute[];
  onChange: (patch: Partial<AttributeOverride>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={override.fromAttributeId}
        aria-label="被替换的属性"
        onChange={(e) => onChange({ fromAttributeId: e.target.value })}
        className={selectClass}
      >
        <option value="">选择属性</option>
        {availableAttributes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <span className="flex-none text-(--muted-2)">→</span>
      <select
        value={override.toAttributeId}
        aria-label="替换为的属性"
        onChange={(e) => onChange({ toAttributeId: e.target.value })}
        className={selectClass}
      >
        <option value="">选择属性</option>
        {availableAttributes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label="删除该覆盖规则"
        onClick={onRemove}
        className="grid size-6 flex-none place-items-center rounded-(--r-sm) text-(--muted-2) hover:bg-(--st-blocked-soft) hover:text-(--st-blocked)"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/** 阶段编辑面板：名称/终态标记/颜色/属性覆盖规则。属性覆盖 UI 骨架本 Task 只落配置，Phase 20 接引擎生效。 */
export function StageEditor({ stageOption, availableAttributes, onUpdate }: StageEditorProps) {
  const [label, setLabel] = useState(stageOption.label);
  const overrides = stageOption.attributeOverrides ?? [];

  function commitLabel() {
    const trimmed = label.trim();
    if (trimmed && trimmed !== stageOption.label) onUpdate({ label: trimmed });
    else setLabel(stageOption.label);
  }

  function updateOverrideAt(index: number, patch: Partial<AttributeOverride>) {
    const next = overrides.map((o, i) => (i === index ? { ...o, ...patch } : o));
    onUpdate({ attributeOverrides: next });
  }

  function removeOverrideAt(index: number) {
    onUpdate({ attributeOverrides: overrides.filter((_, i) => i !== index) });
  }

  function addOverride() {
    onUpdate({ attributeOverrides: [...overrides, { fromAttributeId: "", toAttributeId: "" }] });
  }

  return (
    <div className="flex flex-col gap-3 rounded-(--r-md) bg-(--surface-2) p-3">
      <div>
        <label className={fieldLabelClass}>显示名</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "Escape") setLabel(stageOption.label);
          }}
          className={textInputClass}
        />
      </div>

      <div>
        <label className={fieldLabelClass}>颜色</label>
        <ColorPicker value={stageOption.color} onChange={(color) => onUpdate({ color })} />
      </div>

      <label className="flex items-center gap-2 text-[12.5px] text-(--fg)">
        <button
          type="button"
          role="switch"
          aria-checked={stageOption.isTerminal}
          onClick={() => onUpdate({ isTerminal: !stageOption.isTerminal })}
          className={`relative h-5 w-9 flex-none rounded-full transition-colors ${
            stageOption.isTerminal ? "bg-(--accent)" : "bg-(--border-strong)"
          }`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
              stageOption.isTerminal ? "translate-x-4.5" : "translate-x-0.5"
            }`}
          />
        </button>
        标记为终态阶段
      </label>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className={fieldLabelClass}>属性覆盖（该阶段下用后者替换前者，占同一列位）</span>
          <button
            type="button"
            onClick={addOverride}
            className="flex-none rounded-(--r-sm) border-none bg-transparent px-1.5 py-0.5 text-[11.5px] font-[550] text-(--accent-text) hover:bg-(--accent-soft)"
          >
            + 添加覆盖
          </button>
        </div>
        {overrides.length === 0 ? (
          <p className="m-0 text-[12px] text-(--muted-2)">暂无覆盖规则</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {overrides.map((override, i) => (
              <AttributeOverrideRow
                key={i}
                override={override}
                availableAttributes={availableAttributes}
                onChange={(patch) => updateOverrideAt(i, patch)}
                onRemove={() => removeOverrideAt(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

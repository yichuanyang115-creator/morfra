import { useState } from "react";
import type { Attribute, AttributeType, SelectOption } from "../../types/schema";
import { ATTRIBUTE_TYPE_LABEL, USER_ASSIGNABLE_TYPES } from "../../lib/attributeTypeLabels";
import { nextPaletteColor, paletteColorAt } from "../../lib/stagePalette";
import { newSelectOptionId } from "../../stores/schemaStore";
import { DependencyValueControl } from "./DependencyValueControl";

interface AttributeEditorProps {
  attribute: Attribute;
  /** 其余可作为依赖条件来源的属性（不含自身，见 Schema-自定义机制-讨论稿 §4.1）。 */
  availableAttributes: Attribute[];
  /** 该属性是否为系统骨架/预置计算属性，禁止改类型（Product-Spec REQ-025："骨架属性禁止改类型"）。 */
  typeChangeLocked: boolean;
  onUpdate: (patch: Partial<Attribute>) => void;
  /** 改名走独立入口而非 onUpdate：调用方要做同名拦截（Product-Spec REQ-025："属性命名唯一性：同名拦截"），
   * 失败时把错误信息返回给这里展示，不能悄悄丢弃改名请求。 */
  onRename: (name: string) => { ok: boolean; message?: string };
  /** 有损改类型前的确认：调用方统计受影响条数后决定是否放行，放行时调用 onUpdate 落地新类型。 */
  onRequestTypeChange: (toType: AttributeType) => void;
}

const fieldLabelClass = "block mb-1 text-[11.5px] text-(--module-scope-text-tertiary)";
const textInputClass =
  "w-full rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1.5 font-(family-name:--font-body) text-[13px] text-(--module-scope-text-primary) outline-none focus:border-(--module-scope-action-base)";
const selectClass =
  "min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-1.5 py-1 text-[12px] text-(--module-scope-text-primary) outline-none";

function CloseIcon() {
  return (
    <svg className="size-3" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function isSelectType(type: AttributeType): boolean {
  return type === "singleSelect" || type === "multiSelect";
}

function OptionRow({
  option,
  optionIndex,
  onRename,
  onRemove,
}: {
  option: SelectOption;
  optionIndex: number;
  onRename: (label: string) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(option.label);

  function commit() {
    const trimmed = label.trim();
    if (trimmed && trimmed !== option.label) onRename(trimmed);
    else setLabel(option.label);
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="size-3 flex-none rounded-full" style={{ backgroundColor: option.color ?? paletteColorAt(optionIndex) }} />
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") setLabel(option.label);
        }}
        className={`${textInputClass} flex-1`}
      />
      <button
        type="button"
        aria-label={`删除选项「${option.label}」`}
        onClick={onRemove}
        className="grid size-6 flex-none place-items-center rounded-(--r-sm) text-(--module-scope-text-tertiary) hover:bg-(--module-scope-feedback-danger-soft) hover:text-(--module-scope-feedback-danger)"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/** 属性编辑面板：显示名/类型/选项增删改/看板与详情隐藏开关/显示条件配置。 */
export function AttributeEditor({ attribute, availableAttributes, typeChangeLocked, onUpdate, onRename, onRequestTypeChange }: AttributeEditorProps) {
  const [name, setName] = useState(attribute.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const options = attribute.options ?? [];

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === attribute.name) {
      setName(attribute.name);
      setNameError(null);
      return;
    }
    const result = onRename(trimmed);
    if (!result.ok) {
      setNameError(result.message ?? "改名失败");
      setName(attribute.name);
    } else {
      setNameError(null);
    }
  }

  function renameOptionAt(index: number, label: string) {
    onUpdate({ options: options.map((o, i) => (i === index ? { ...o, label } : o)) });
  }

  function removeOptionAt(index: number) {
    onUpdate({ options: options.filter((_, i) => i !== index) });
  }

  function addOption() {
    onUpdate({
      options: [...options, { id: newSelectOptionId(), label: "新选项", color: nextPaletteColor(options.map((option) => option.color)) }],
    });
  }

  const dependencySource = availableAttributes.find((a) => a.id === attribute.dependsOn?.attributeId);

  return (
    <div className="flex flex-col gap-3 rounded-(--r-md) bg-(--module-scope-background-elevated) p-3">
      <div>
        <label className={fieldLabelClass}>显示名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "Escape") setName(attribute.name);
          }}
          className={textInputClass}
        />
        {nameError && <p className="m-0 mt-1 text-[11.5px] text-(--module-scope-feedback-danger)">{nameError}</p>}
      </div>

      <div>
        <label className={fieldLabelClass}>类型</label>
        {typeChangeLocked ? (
          <p className="m-0 text-[12.5px] text-(--module-scope-text-secondary)">{ATTRIBUTE_TYPE_LABEL[attribute.type]}（系统属性，不可改类型）</p>
        ) : (
          <select
            value={attribute.type}
            onChange={(e) => onRequestTypeChange(e.target.value as AttributeType)}
            className={`${selectClass} w-full`}
          >
            {USER_ASSIGNABLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {ATTRIBUTE_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        )}
      </div>

      {isSelectType(attribute.type) && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className={fieldLabelClass}>选项</span>
            <button
              type="button"
              onClick={addOption}
              className="flex-none rounded-(--r-sm) border-none bg-transparent px-1.5 py-0.5 text-[11.5px] font-[550] text-(--module-scope-action-strong) hover:bg-(--module-scope-action-soft)"
            >
              + 添加选项
            </button>
          </div>
          {options.length === 0 ? (
            <p className="m-0 text-[12px] text-(--module-scope-text-tertiary)">暂无选项</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {options.map((option, i) => (
                <OptionRow
                  key={option.id}
                  option={option}
                  optionIndex={i}
                  onRename={(label) => renameOptionAt(i, label)}
                  onRemove={() => removeOptionAt(i)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <span className={fieldLabelClass}>显示条件（该属性仅当以下条件满足时显示）</span>
        <div className="flex items-center gap-1.5">
          <select
            value={attribute.dependsOn?.attributeId ?? ""}
            aria-label="依赖属性"
            onChange={(e) => {
              const attributeId = e.target.value;
              onUpdate({ dependsOn: attributeId ? { attributeId, value: "" } : undefined });
            }}
            className={selectClass}
          >
            <option value="">不设置</option>
            {availableAttributes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="flex-none text-(--module-scope-text-tertiary)">=</span>
          <DependencyValueControl
            key={attribute.dependsOn?.attributeId ?? "none"}
            source={dependencySource}
            value={attribute.dependsOn?.value}
            onChange={(value) => {
              if (!attribute.dependsOn) return;
              onUpdate({ dependsOn: { ...attribute.dependsOn, value } });
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-[12.5px] text-(--module-scope-text-primary)">
          <input type="checkbox" checked={attribute.showOnBoard} onChange={(e) => onUpdate({ showOnBoard: e.target.checked })} />
          看板显示
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-(--module-scope-text-primary)">
          <input type="checkbox" checked={attribute.showOnDetail} onChange={(e) => onUpdate({ showOnDetail: e.target.checked })} />
          详情页显示
        </label>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { TabDefinition, TabField, TabRenderer } from "../../types/schema";
import { newSelectOptionId } from "../../stores/schemaStore";

const RENDERER_LABEL: Record<TabRenderer, string> = {
  body: "正文（固定特例，接入数据层，不可删）",
  activity: "活动（固定特例，接入数据层，不可删）",
  deliverables: "产出（预制专用渲染器）",
  tasks: "任务（预制专用渲染器）",
  acceptance: "验收（预制专用渲染器）",
  generic: "通用渲染器（自定义 Tab）",
};

const fieldLabelClass = "block mb-1 text-[11.5px] text-(--muted-2)";
const textInputClass =
  "w-full rounded-(--r-sm) border border-(--border) bg-(--surface) px-2 py-1.5 font-(family-name:--font-body) text-[13px] text-(--fg) outline-none focus:border-(--accent)";

interface TabEditorProps {
  tab: TabDefinition;
  onUpdate: (patch: Partial<TabDefinition>) => void;
}

/** Tab 详情编辑：改名、渲染器只读展示和字段结构维护。 */
export function TabEditor({ tab, onUpdate }: TabEditorProps) {
  const [name, setName] = useState(tab.name);
  const fields = tab.fields ?? [];

  useEffect(() => {
    setName(tab.name);
  }, [tab.id, tab.name]);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== tab.name) onUpdate({ name: trimmed });
    else setName(tab.name);
  }

  function updateField(index: number, patch: Partial<TabField>) {
    onUpdate({ fields: fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)) });
  }

  return (
    <div className="flex flex-col gap-3 rounded-(--r-md) bg-(--surface-2) p-3">
      <div>
        <label className={fieldLabelClass}>显示名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "Escape") setName(tab.name);
          }}
          className={textInputClass}
        />
      </div>

      <div>
        <span className={fieldLabelClass}>渲染器</span>
        <p className="m-0 text-[12.5px] text-(--fg)">{RENDERER_LABEL[tab.renderer]}</p>
      </div>

      <div>
        <span className={fieldLabelClass}>字段结构</span>
        {fields.length === 0 ? <p className="m-0 text-[12.5px] text-(--muted-2)">暂无字段，通用 Tab 将使用默认名称字段。</p> : (
          <div className="mt-1.5 flex flex-col gap-1.5">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-1.5">
                <input aria-label={`字段${index + 1}名称`} value={field.name} onChange={(event) => updateField(index, { name: event.target.value })} className={`${textInputClass} flex-1`} />
                <button type="button" aria-label={`删除字段${field.name}`} onClick={() => onUpdate({ fields: fields.filter((_, fieldIndex) => fieldIndex !== index) })} className="rounded-(--r-sm) px-2 py-1 text-[11px] text-(--muted-2) hover:bg-(--st-blocked-soft) hover:text-(--st-blocked)">删除</button>
              </div>
            ))}
          </div>
        )}
        {tab.renderer === "generic" && <button type="button" onClick={() => onUpdate({ fields: [...fields, { id: newSelectOptionId(), name: "新字段", type: "text" }] })} className="mt-2 rounded-(--r-sm) border border-(--border) px-2 py-1 text-[11.5px] text-(--muted) hover:border-(--accent) hover:text-(--accent-text)">+ 添加字段</button>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { TabDefinition, TabRenderer } from "../../types/schema";

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

/** Tab 详情编辑：改名 + 渲染器只读展示 + 字段配置占位（字段级配置留给 Phase 23 Tab 模型重构）。 */
export function TabEditor({ tab, onUpdate }: TabEditorProps) {
  const [name, setName] = useState(tab.name);

  useEffect(() => {
    setName(tab.name);
  }, [tab.id, tab.name]);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== tab.name) onUpdate({ name: trimmed });
    else setName(tab.name);
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
        <p className="m-0 text-[12.5px] text-(--muted-2)">字段结构配置将在后续开发中支持。</p>
      </div>
    </div>
  );
}

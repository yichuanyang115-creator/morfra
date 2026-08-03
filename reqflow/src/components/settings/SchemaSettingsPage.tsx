import type { Schema } from "../../types/schema";
import type { SettingsSection } from "../../stores/uiStore";
import { SettingsNav } from "./SettingsNav";

function CloseIcon() {
  return (
    <svg className="icon icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface SchemaSettingsPageProps {
  schema: Schema;
  section: SettingsSection;
  onSelectSection: (section: SettingsSection) => void;
  onClose: () => void;
}

/** 区域内容渲染留空占位，阶段/属性/Tab 管理区分别在各自 Task 中接入。 */
function SectionContent({ section }: { section: SettingsSection }) {
  const label = section.kind === "stages" ? "阶段管理" : section.kind === "attributes" ? "属性管理" : "Tab 字段配置";
  return <div className="p-5 text-[13px] text-(--muted-2)">{label}区域即将上线</div>;
}

export function SchemaSettingsPage({ schema, section, onSelectSection, onClose }: SchemaSettingsPageProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none items-center justify-between border-b border-(--border) px-4.5 py-3">
        <span className="font-(family-name:--font-display) text-[15px] font-[590] text-(--fg)">Schema 设置</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            title="Phase 25 接功能"
            className="rounded-(--r-sm) border border-(--border-strong) bg-(--surface) px-3 py-1.5 text-[12.5px] text-(--muted-2) disabled:cursor-not-allowed"
          >
            保存为模板
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="grid size-7 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent text-(--muted) hover:bg-(--surface-2) hover:text-(--fg)"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <SettingsNav schema={schema} section={section} onSelect={onSelectSection} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SectionContent section={section} />
        </div>
      </div>
    </div>
  );
}

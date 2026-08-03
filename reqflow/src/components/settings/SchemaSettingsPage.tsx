import type { StageOption, Schema } from "../../types/schema";
import type { SettingsSection } from "../../stores/uiStore";
import { SettingsNav } from "./SettingsNav";
import { StageManager } from "./StageManager";

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
  entityCountByStage: Record<string, number>;
  onSelectSection: (section: SettingsSection) => void;
  onClose: () => void;
  onReorderStages: (orderedIds: string[]) => void;
  onAddStage: (stageOption: StageOption) => void;
  onUpdateStage: (stageOptionId: string, patch: Partial<StageOption>) => void;
  onRemoveStage: (stageOptionId: string) => void;
}

/** 属性/Tab 管理区留空占位，分别在各自 Task 中接入。 */
function SectionContent({
  schema,
  section,
  entityCountByStage,
  onReorderStages,
  onAddStage,
  onUpdateStage,
  onRemoveStage,
}: {
  schema: Schema;
  section: SettingsSection;
  entityCountByStage: Record<string, number>;
  onReorderStages: (orderedIds: string[]) => void;
  onAddStage: (stageOption: StageOption) => void;
  onUpdateStage: (stageOptionId: string, patch: Partial<StageOption>) => void;
  onRemoveStage: (stageOptionId: string) => void;
}) {
  if (section.kind === "stages") {
    return (
      <StageManager
        stageOptions={schema.stageOptions}
        entityCountByStage={entityCountByStage}
        availableAttributes={schema.attributes}
        onReorder={onReorderStages}
        onAdd={onAddStage}
        onUpdate={onUpdateStage}
        onRemove={onRemoveStage}
      />
    );
  }

  const label = section.kind === "attributes" ? "属性管理" : "Tab 字段配置";
  return <div className="p-5 text-[13px] text-(--muted-2)">{label}区域即将上线</div>;
}

export function SchemaSettingsPage({
  schema,
  section,
  entityCountByStage,
  onSelectSection,
  onClose,
  onReorderStages,
  onAddStage,
  onUpdateStage,
  onRemoveStage,
}: SchemaSettingsPageProps) {
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
          <SectionContent
            schema={schema}
            section={section}
            entityCountByStage={entityCountByStage}
            onReorderStages={onReorderStages}
            onAddStage={onAddStage}
            onUpdateStage={onUpdateStage}
            onRemoveStage={onRemoveStage}
          />
        </div>
      </div>
    </div>
  );
}

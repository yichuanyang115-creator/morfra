import { useState } from "react";
import type { Attribute, AttributeType, StageOption, TabDefinition, Schema } from "../../types/schema";
import type { SettingsSection } from "../../stores/uiStore";
import { SettingsNav } from "./SettingsNav";
import { StageManager } from "./StageManager";
import { AttributeManager } from "./AttributeManager";
import { TabManager } from "./TabManager";
import { SaveTemplateDialog } from "./SaveTemplateDialog";

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
  onReorderAttributes: (orderedIds: string[]) => void;
  onAddAttribute: (attribute: Attribute) => void;
  onUpdateAttribute: (attributeId: string, patch: Partial<Attribute>) => void;
  onRemoveAttribute: (attributeId: string) => void;
  countValuedAttribute: (attributeId: string) => number;
  getTypeChangeImpact: (attributeId: string, toType: AttributeType) => { totalCount: number; lostCount: number };
  onConfirmTypeChange: (attributeId: string, toType: AttributeType) => void;
  onReorderTabs: (orderedIds: string[]) => void;
  onAddTab: (tab: TabDefinition) => void;
  onUpdateTab: (tabId: string, patch: Partial<TabDefinition>) => void;
  onRemoveTab: (tabId: string) => void;
  onSaveTemplate?: (name: string) => Promise<void>;
}

function SectionContent({
  schema,
  section,
  entityCountByStage,
  onReorderStages,
  onAddStage,
  onUpdateStage,
  onRemoveStage,
  onReorderAttributes,
  onAddAttribute,
  onUpdateAttribute,
  onRemoveAttribute,
  countValuedAttribute,
  getTypeChangeImpact,
  onConfirmTypeChange,
  onReorderTabs,
  onAddTab,
  onUpdateTab,
  onRemoveTab,
}: Omit<SchemaSettingsPageProps, "onSelectSection" | "onClose">) {
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

  if (section.kind === "tab") {
    return (
      <TabManager
        tabs={schema.tabs}
        selectedTabId={section.tabId}
        onReorder={onReorderTabs}
        onAdd={onAddTab}
        onUpdate={onUpdateTab}
        onRemove={onRemoveTab}
      />
    );
  }

  return (
    <AttributeManager
      attributes={schema.attributes}
      selectedAttributeId={section.attributeId}
      onReorder={onReorderAttributes}
      onAdd={onAddAttribute}
      onUpdate={onUpdateAttribute}
      onRemove={onRemoveAttribute}
      countValued={countValuedAttribute}
      getTypeChangeImpact={getTypeChangeImpact}
      onConfirmTypeChange={onConfirmTypeChange}
    />
  );
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
  onReorderAttributes,
  onAddAttribute,
  onUpdateAttribute,
  onRemoveAttribute,
  countValuedAttribute,
  getTypeChangeImpact,
  onConfirmTypeChange,
  onReorderTabs,
  onAddTab,
  onUpdateTab,
  onRemoveTab,
  onSaveTemplate,
}: SchemaSettingsPageProps) {
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  return (
    <div data-theme-module="settings" className="theme-module-settings flex h-full min-h-0 flex-col bg-(--surface)">
      <div className="flex flex-none items-center justify-between border-b border-(--border) px-4.5 py-3">
        <span className="font-(family-name:--font-display) text-[15px] font-[590] text-(--fg)">Schema 设置</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSaveTemplateOpen(true)}
            className="rounded-(--r-sm) border border-(--border-strong) bg-(--surface) px-3 py-1.5 text-[12.5px] text-(--muted-2) hover:border-(--accent) hover:text-(--accent-text)"
          >
            保存为模板
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="grid size-7 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent text-(--muted) hover:bg-(--accent-soft) hover:text-(--accent-text)"
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
            onReorderAttributes={onReorderAttributes}
            onAddAttribute={onAddAttribute}
            onUpdateAttribute={onUpdateAttribute}
            onRemoveAttribute={onRemoveAttribute}
            countValuedAttribute={countValuedAttribute}
            getTypeChangeImpact={getTypeChangeImpact}
            onConfirmTypeChange={onConfirmTypeChange}
            onReorderTabs={onReorderTabs}
            onAddTab={onAddTab}
            onUpdateTab={onUpdateTab}
            onRemoveTab={onRemoveTab}
          />
        </div>
      </div>
      {saveTemplateOpen && onSaveTemplate && (
        <SaveTemplateDialog
          onCancel={() => setSaveTemplateOpen(false)}
          onSave={async (name) => {
            await onSaveTemplate(name);
            setSaveTemplateOpen(false);
          }}
        />
      )}
    </div>
  );
}

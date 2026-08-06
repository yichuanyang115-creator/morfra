import { countValuedAttribute, typeChangeImpact } from "../../lib/attributeImpact";
import { convertAttributeValue, optionsForTypeChange } from "../../lib/attributeTypeConversion";
import { useProjectStore } from "../../stores/projectStore";
import { useRequirementStore } from "../../stores/requirementStore";
import { useSchemaStore } from "../../stores/schemaStore";
import { useTemplateStore } from "../../stores/templateStore";
import { useUiStore } from "../../stores/uiStore";
import { SchemaSettingsPage } from "./SchemaSettingsPage";

/** 将 Schema 设置的写入编排收敛在边界组件，避免 App 同时承担页面路由和全部设置行为。 */
export function SchemaSettingsWorkspace() {
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const requirements = useRequirementStore((state) => state.requirements);
  const cascadeAttributeChange = useRequirementStore((state) => state.cascadeAttributeChange);
  const freezeStageHistory = useRequirementStore((state) => state.freezeStageHistory);
  const schema = useSchemaStore((state) => state.schema);
  const section = useUiStore((state) => state.settingsSection);
  const setSection = useUiStore((state) => state.setSettingsSection);
  const closeSettings = useUiStore((state) => state.closeSettings);
  const addStageOption = useSchemaStore((state) => state.addStageOption);
  const updateStageOption = useSchemaStore((state) => state.updateStageOption);
  const removeStageOption = useSchemaStore((state) => state.removeStageOption);
  const reorderStageOptions = useSchemaStore((state) => state.reorderStageOptions);
  const addAttribute = useSchemaStore((state) => state.addAttribute);
  const updateAttribute = useSchemaStore((state) => state.updateAttribute);
  const removeAttribute = useSchemaStore((state) => state.removeAttribute);
  const reorderAttributes = useSchemaStore((state) => state.reorderAttributes);
  const addTab = useSchemaStore((state) => state.addTab);
  const updateTab = useSchemaStore((state) => state.updateTab);
  const removeTab = useSchemaStore((state) => state.removeTab);
  const reorderTabs = useSchemaStore((state) => state.reorderTabs);
  const saveTemplate = useTemplateStore((state) => state.saveFromSchema);

  if (!schema || !section) return null;
  const entityCountByStage = requirements.reduce<Record<string, number>>((counts, requirement) => {
    counts[requirement.stage] = (counts[requirement.stage] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <SchemaSettingsPage
      schema={schema}
      section={section}
      entityCountByStage={entityCountByStage}
      onSelectSection={setSection}
      onClose={closeSettings}
      onReorderStages={(orderedIds) => { if (currentProjectId) void reorderStageOptions(currentProjectId, orderedIds); }}
      onAddStage={(stageOption) => { if (currentProjectId) void addStageOption(currentProjectId, stageOption); }}
      onUpdateStage={(id, patch) => { if (currentProjectId) void updateStageOption(currentProjectId, id, patch); }}
      onRemoveStage={(id) => {
        if (!currentProjectId) return;
        const stage = schema.stageOptions.find((item) => item.id === id);
        if (!stage) return;
        void (async () => {
          await freezeStageHistory(currentProjectId, stage);
          await removeStageOption(currentProjectId, id);
        })();
      }}
      onReorderAttributes={(orderedIds) => { if (currentProjectId) void reorderAttributes(currentProjectId, orderedIds); }}
      onAddAttribute={(attribute) => { if (currentProjectId) void addAttribute(currentProjectId, attribute); }}
      onUpdateAttribute={(id, patch) => { if (currentProjectId) void updateAttribute(currentProjectId, id, patch); }}
      onRemoveAttribute={(id) => {
        if (!currentProjectId) return;
        void removeAttribute(currentProjectId, id);
        void cascadeAttributeChange(currentProjectId, id, () => undefined);
      }}
      countValuedAttribute={(id) => countValuedAttribute(requirements, id)}
      getTypeChangeImpact={(id, toType) => {
        const attribute = schema.attributes.find((item) => item.id === id);
        return attribute ? typeChangeImpact(requirements, attribute, toType) : { totalCount: requirements.length, lostCount: 0 };
      }}
      onConfirmTypeChange={(id, toType) => {
        if (!currentProjectId) return;
        const attribute = schema.attributes.find((item) => item.id === id);
        if (!attribute) return;
        const toOptions = optionsForTypeChange(attribute, toType);
        void updateAttribute(currentProjectId, id, { type: toType, options: toOptions });
        void cascadeAttributeChange(currentProjectId, id, (value) => convertAttributeValue(value, attribute, toType, toOptions).value);
      }}
      onReorderTabs={(orderedIds) => { if (currentProjectId) void reorderTabs(currentProjectId, orderedIds); }}
      onAddTab={(tab) => { if (currentProjectId) void addTab(currentProjectId, tab); }}
      onUpdateTab={(id, patch) => { if (currentProjectId) void updateTab(currentProjectId, id, patch); }}
      onRemoveTab={(id) => { if (currentProjectId) void removeTab(currentProjectId, id); }}
      onSaveTemplate={(name) => saveTemplate(name, schema)}
    />
  );
}

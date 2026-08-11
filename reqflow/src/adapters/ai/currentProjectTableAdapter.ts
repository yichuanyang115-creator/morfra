import { useProjectStore, type ProjectState } from "../../stores/projectStore";
import { useRequirementStore } from "../../stores/requirementStore";
import { useSchemaStore } from "../../stores/schemaStore";
import { useUiStore } from "../../stores/uiStore";
import type { Requirement } from "../../types/models";
import type { Attribute, Schema } from "../../types/schema";
import type { TableDataAdapter, TableEvent, TableField, TableSnapshot } from "../../lib/ai/tableDataAdapter";
import { normalizeTableSnapshot } from "../../lib/ai/tableSnapshot";

const NAME_FIELD_ID = "name";
const STAGE_FIELD_ID = "stage";

export interface CurrentProjectRequirementState {
  requirements: Requirement[];
  loadedProjectId: string | null;
}

export interface CurrentProjectSchemaState {
  schema: Schema | null;
  loadedProjectId: string | null;
}

export interface CurrentProjectUIState {
  selectedRequirementId: string | null;
  selectRequirement: (id: string) => void;
}

export interface CurrentProjectStore<State> {
  getState: () => State;
  subscribe: (listener: (state: State, previousState: State) => void) => () => void;
}

export interface CurrentProjectTableAdapterDependencies {
  projectStore: CurrentProjectStore<Pick<ProjectState, "projects" | "currentProjectId">>;
  requirementStore: CurrentProjectStore<CurrentProjectRequirementState>;
  schemaStore: CurrentProjectStore<CurrentProjectSchemaState>;
  uiStore: CurrentProjectStore<CurrentProjectUIState>;
}

export interface CurrentProjectTableAdapter extends TableDataAdapter {
  dispose: () => void;
}

export interface CurrentProjectHostActions {
  openRecord: (input: { tableId: string; recordId: string }) => void;
}

const defaultDependencies: CurrentProjectTableAdapterDependencies = {
  projectStore: useProjectStore,
  requirementStore: useRequirementStore,
  schemaStore: useSchemaStore,
  uiStore: useUiStore,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function attachmentMetadata(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || typeof candidate.name !== "string") return [];
    const metadata: Record<string, string> = { id: candidate.id, name: candidate.name };
    if (typeof candidate.mimeType === "string") metadata.mimeType = candidate.mimeType;
    return [metadata];
  });
}

function fieldForAttribute(attribute: Attribute): TableField {
  return {
    id: attribute.id,
    name: attribute.name,
    type: attribute.type,
    options: attribute.options?.map((option) => ({ id: option.id, label: option.label })),
  };
}

function fieldsForSchema(schema: Schema): TableField[] {
  const fields: TableField[] = [
    { id: NAME_FIELD_ID, name: "Name", type: "text" },
    {
      id: STAGE_FIELD_ID,
      name: "Stage",
      type: "singleSelect",
      options: schema.stageOptions.map((option) => ({ id: option.id, label: option.label })),
    },
    ...schema.attributes.map(fieldForAttribute),
  ];
  const fieldIds = new Set<string>();
  for (const field of fields) {
    if (fieldIds.has(field.id)) throw new Error(`临时表适配字段 ID 冲突：${field.id}`);
    fieldIds.add(field.id);
  }
  return fields;
}

function valuesForRequirement(requirement: Requirement, schema: Schema): Record<string, unknown> {
  const values: Record<string, unknown> = {
    [NAME_FIELD_ID]: requirement.name,
    [STAGE_FIELD_ID]: requirement.stage,
  };
  for (const attribute of schema.attributes) {
    const value = requirement.attributeValues[attribute.id];
    values[attribute.id] = attribute.type === "attachment" ? attachmentMetadata(value) : value;
  }
  return values;
}

function snapshotFor(
  tableId: string,
  projectName: string,
  schema: Schema,
  requirements: readonly Requirement[],
): TableSnapshot {
  const fields = fieldsForSchema(schema);
  return normalizeTableSnapshot({
    tableId,
    name: projectName,
    schemaVersion: `schema-${schema.version}`,
    primaryTitleFieldId: NAME_FIELD_ID,
    fields,
    records: requirements.map((requirement) => ({ id: requirement.id, values: valuesForRequirement(requirement, schema) })),
    capturedAt: new Date().toISOString(),
  });
}

function currentProject(dependencies: CurrentProjectTableAdapterDependencies) {
  const state = dependencies.projectStore.getState();
  return state.projects.find((project) => project.id === state.currentProjectId) ?? null;
}

function tableSources(dependencies: CurrentProjectTableAdapterDependencies, tableId: string) {
  const project = currentProject(dependencies);
  if (!project || project.id !== tableId) throw new Error(`当前临时宿主没有表：${tableId}`);
  const schemaState = dependencies.schemaStore.getState();
  const requirementState = dependencies.requirementStore.getState();
  if (schemaState.loadedProjectId !== tableId || !schemaState.schema) throw new Error(`表 ${tableId} 的 Schema 尚未完成加载`);
  if (requirementState.loadedProjectId !== tableId) throw new Error(`表 ${tableId} 的记录尚未完成加载`);
  return { project, schema: schemaState.schema, requirements: requirementState.requirements };
}

export function createCurrentProjectTableAdapter(
  dependencies: CurrentProjectTableAdapterDependencies = defaultDependencies,
): CurrentProjectTableAdapter {
  const listeners = new Set<(event: TableEvent) => void>();
  const emit = (event: TableEvent): void => {
    for (const listener of listeners) listener(structuredClone(event));
  };

  const projectUnsubscribe = dependencies.projectStore.subscribe((state, previousState) => {
    if (state.currentProjectId !== previousState.currentProjectId) {
      emit({ type: "active-table-changed", tableId: state.currentProjectId });
    } else if (state.projects !== previousState.projects && state.currentProjectId) {
      emit({ type: "table-data-changed", tableId: state.currentProjectId });
    }
  });
  const requirementUnsubscribe = dependencies.requirementStore.subscribe((state, previousState) => {
    if (state.requirements === previousState.requirements && state.loadedProjectId === previousState.loadedProjectId) return;
    const tableId = state.loadedProjectId ?? previousState.loadedProjectId ?? currentProject(dependencies)?.id;
    if (tableId) emit({ type: "table-data-changed", tableId });
  });
  const schemaUnsubscribe = dependencies.schemaStore.subscribe((state, previousState) => {
    if (state.schema === previousState.schema && state.loadedProjectId === previousState.loadedProjectId) return;
    const tableId = state.loadedProjectId ?? previousState.loadedProjectId ?? currentProject(dependencies)?.id;
    if (tableId) emit({ type: "table-data-changed", tableId });
  });
  const uiUnsubscribe = dependencies.uiStore.subscribe((state, previousState) => {
    if (state.selectedRequirementId === previousState.selectedRequirementId) return;
    const tableId = currentProject(dependencies)?.id;
    if (tableId) emit({ type: "selection-changed", tableId, recordIds: state.selectedRequirementId ? [state.selectedRequirementId] : [] });
  });

  return {
    getActiveTable() {
      const project = currentProject(dependencies);
      return project ? { tableId: project.id, name: project.name } : null;
    },
    async getTableSnapshot(tableId) {
      const sources = tableSources(dependencies, tableId);
      return snapshotFor(tableId, sources.project.name, sources.schema, sources.requirements);
    },
    getSelectedRecordIds(tableId) {
      const project = currentProject(dependencies);
      if (!project || project.id !== tableId) return [];
      const selectedId = dependencies.uiStore.getState().selectedRequirementId;
      if (!selectedId) return [];
      return dependencies.requirementStore.getState().requirements.some((requirement) => requirement.id === selectedId) ? [selectedId] : [];
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      projectUnsubscribe();
      requirementUnsubscribe();
      schemaUnsubscribe();
      uiUnsubscribe();
      listeners.clear();
    },
  };
}

export function createCurrentProjectHostActions(
  uiStore: CurrentProjectStore<CurrentProjectUIState> = defaultDependencies.uiStore,
): CurrentProjectHostActions {
  return {
    openRecord: (input) => {
      uiStore.getState().selectRequirement(input.recordId);
    },
  };
}

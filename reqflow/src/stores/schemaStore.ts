import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Attribute, Schema, StageOption, TabDefinition } from "../types/schema";
import { writeFile } from "../lib/fs";
import { schemaPath } from "../lib/paths";
import { migrateIfNeeded } from "../lib/migration";
import { blankSchema } from "../lib/schemaDefaults";

interface SchemaState {
  schema: Schema | null;
  loadedProjectId: string | null;
  /** 本次 loadForProject 是否触发了迁移（无 schema.json → 新生成），供 UI 弹一次性 toast。 */
  justMigrated: boolean;
  loadForProject: (projectId: string, sources: string[]) => Promise<void>;
  initBlankForProject: (projectId: string) => Promise<void>;
  acknowledgeMigration: () => void;
  addAttribute: (projectId: string, attribute: Attribute) => Promise<void>;
  updateAttribute: (projectId: string, attributeId: string, patch: Partial<Attribute>) => Promise<void>;
  removeAttribute: (projectId: string, attributeId: string) => Promise<void>;
  addStageOption: (projectId: string, stageOption: StageOption) => Promise<void>;
  updateStageOption: (projectId: string, stageOptionId: string, patch: Partial<StageOption>) => Promise<void>;
  removeStageOption: (projectId: string, stageOptionId: string) => Promise<void>;
  addTab: (projectId: string, tab: TabDefinition) => Promise<void>;
  updateTab: (projectId: string, tabId: string, patch: Partial<TabDefinition>) => Promise<void>;
  removeTab: (projectId: string, tabId: string) => Promise<void>;
}

type Get = () => SchemaState;
type Set = (fn: (state: SchemaState) => Partial<SchemaState>) => void;

async function persistSchema(projectId: string, schema: Schema): Promise<void> {
  const path = await schemaPath(projectId);
  await writeFile(path, JSON.stringify(schema, null, 2));
}

async function mutateSchema(get: Get, set: Set, projectId: string, transform: (schema: Schema) => Schema): Promise<void> {
  const schema = get().schema;
  if (!schema) return;
  const updated = transform(schema);
  await persistSchema(projectId, updated);
  set(() => ({ schema: updated }));
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  schema: null,
  loadedProjectId: null,
  justMigrated: false,

  loadForProject: async (projectId, sources) => {
    const { migrated, schema } = await migrateIfNeeded(projectId, sources);
    set({ schema, loadedProjectId: projectId, justMigrated: migrated });
  },

  initBlankForProject: async (projectId) => {
    const schema = blankSchema();
    await persistSchema(projectId, schema);
    set({ schema, loadedProjectId: projectId, justMigrated: false });
  },

  acknowledgeMigration: () => {
    set({ justMigrated: false });
  },

  addAttribute: (projectId, attribute) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      attributes: [...schema.attributes, attribute],
    })),

  updateAttribute: (projectId, attributeId, patch) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      attributes: schema.attributes.map((a) => (a.id === attributeId ? { ...a, ...patch } : a)),
    })),

  removeAttribute: (projectId, attributeId) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      attributes: schema.attributes.filter((a) => a.id !== attributeId),
    })),

  addStageOption: (projectId, stageOption) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      stageOptions: [...schema.stageOptions, stageOption],
    })),

  updateStageOption: (projectId, stageOptionId, patch) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      stageOptions: schema.stageOptions.map((s) => (s.id === stageOptionId ? { ...s, ...patch } : s)),
    })),

  removeStageOption: (projectId, stageOptionId) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      stageOptions: schema.stageOptions.filter((s) => s.id !== stageOptionId),
    })),

  addTab: (projectId, tab) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      tabs: [...schema.tabs, tab],
    })),

  updateTab: (projectId, tabId, patch) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      tabs: schema.tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t)),
    })),

  removeTab: (projectId, tabId) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      tabs: schema.tabs.filter((t) => t.id !== tabId),
    })),
}));

/** 生成一个新属性 id（Schema 讨论稿拍板：复用 nanoid）。 */
export function newAttributeId(): string {
  return nanoid();
}

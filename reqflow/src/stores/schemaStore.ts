import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Attribute, FilterCondition, Schema, SortRule, StageOption, StageSortPreference, TabDefinition } from "../types/schema";
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
  reorderStageOptions: (projectId: string, orderedIds: string[]) => Promise<void>;
  reorderAttributes: (projectId: string, orderedIds: string[]) => Promise<void>;
  addTab: (projectId: string, tab: TabDefinition) => Promise<void>;
  updateTab: (projectId: string, tabId: string, patch: Partial<TabDefinition>) => Promise<void>;
  removeTab: (projectId: string, tabId: string) => Promise<void>;
  reorderTabs: (projectId: string, orderedIds: string[]) => Promise<void>;
  setColumnOrder: (projectId: string, orderedIds: string[]) => Promise<void>;
  setColumnWidth: (projectId: string, attributeId: string, width: number) => Promise<void>;
  setFrozenCount: (projectId: string, count: number) => Promise<void>;
  /** 整体替换看板筛选条件集合（REQ-026 多条件 AND，按项目落盘）。空数组 = 清除筛选。 */
  setFilters: (projectId: string, filters: FilterCondition[]) => Promise<void>;
  setGlobalSort: (projectId: string, sort: SortRule | null) => Promise<void>;
  setStageSort: (projectId: string, stageId: string, sort: SortRule) => Promise<void>;
  setStageSortManual: (projectId: string, stageId: string) => Promise<void>;
  clearStageSort: (projectId: string, stageId: string) => Promise<void>;
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
    mutateSchema(get, set, projectId, (schema) => {
      const globalSort = schema.viewPreferences.globalSort?.attrId === attributeId ? null : schema.viewPreferences.globalSort;
      const stageSorts = Object.fromEntries(
        Object.entries(schema.viewPreferences.stageSorts ?? {}).filter(([, sort]) => !("attrId" in sort && sort.attrId === attributeId)),
      );
      return {
        ...schema,
        attributes: schema.attributes.filter((a) => a.id !== attributeId),
        viewPreferences: { ...schema.viewPreferences, globalSort, stageSorts },
      };
    }),

  reorderAttributes: (projectId, orderedIds) =>
    mutateSchema(get, set, projectId, (schema) => {
      const byId = new Map(schema.attributes.map((a) => [a.id, a]));
      const reordered = orderedIds.map((id) => byId.get(id)).filter((a): a is Attribute => a !== undefined);
      return { ...schema, attributes: reordered };
    }),

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
    mutateSchema(get, set, projectId, (schema) => {
      // Stage 选项最少 1 个，不允许清空到 0（Product-Spec REQ-025 MUST），store 层兜底
      // 而不是只靠 UI 禁用——防止调用方漏加保护导致应用进入无阶段可用的坏状态。
      if (schema.stageOptions.length <= 1) return schema;
      return { ...schema, stageOptions: schema.stageOptions.filter((s) => s.id !== stageOptionId) };
    }),

  reorderStageOptions: (projectId, orderedIds) =>
    mutateSchema(get, set, projectId, (schema) => {
      const byId = new Map(schema.stageOptions.map((s) => [s.id, s]));
      const reordered = orderedIds.map((id) => byId.get(id)).filter((s): s is StageOption => s !== undefined);
      return { ...schema, stageOptions: reordered };
    }),

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

  reorderTabs: (projectId, orderedIds) =>
    mutateSchema(get, set, projectId, (schema) => {
      const byId = new Map(schema.tabs.map((t) => [t.id, t]));
      const reordered = orderedIds.map((id) => byId.get(id)).filter((t): t is TabDefinition => t !== undefined);
      return { ...schema, tabs: reordered };
    }),

  // 视图偏好（列宽/列序/冻结）不改 attributes 数组本身，只写 viewPreferences——
  // 讨论稿 §7 把它归为"可逆、不动 Schema"的一层，与 reorderAttributes 改属性
  // 定义顺序是两件不同的事（见 schemaSelectors.boardAttributesFor 的排序优先级）。
  setColumnOrder: (projectId, orderedIds) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      viewPreferences: { ...schema.viewPreferences, columnOrder: orderedIds },
    })),

  setColumnWidth: (projectId, attributeId, width) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      viewPreferences: {
        ...schema.viewPreferences,
        columnWidths: { ...schema.viewPreferences.columnWidths, [attributeId]: width },
      },
    })),

  setFrozenCount: (projectId, count) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      viewPreferences: { ...schema.viewPreferences, frozenCount: count },
    })),

  setFilters: (projectId, filters) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      viewPreferences: { ...schema.viewPreferences, filters },
    })),

  setGlobalSort: (projectId, sort) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      viewPreferences: { ...schema.viewPreferences, globalSort: sort },
    })),

  setStageSort: (projectId, stageId, sort) =>
    mutateSchema(get, set, projectId, (schema) => ({
      ...schema,
      viewPreferences: {
        ...schema.viewPreferences,
        stageSorts: { ...schema.viewPreferences.stageSorts, [stageId]: sort },
      },
    })),

  setStageSortManual: (projectId, stageId) =>
    mutateSchema(get, set, projectId, (schema) => {
      const stageSorts: Record<string, StageSortPreference> = {
        ...schema.viewPreferences.stageSorts,
        [stageId]: { mode: "manual" },
      };
      return { ...schema, viewPreferences: { ...schema.viewPreferences, stageSorts } };
    }),

  clearStageSort: (projectId, stageId) =>
    mutateSchema(get, set, projectId, (schema) => {
      const stageSorts = { ...schema.viewPreferences.stageSorts };
      delete stageSorts[stageId];
      return { ...schema, viewPreferences: { ...schema.viewPreferences, stageSorts } };
    }),
}));

/** 生成一个新属性 id（Schema 讨论稿拍板：复用 nanoid）。 */
export function newAttributeId(): string {
  return nanoid();
}

/** 生成一个新阶段选项 id，同样复用 nanoid（内置模板阶段用固定字面量 id，用户自建阶段走这里）。 */
export function newStageOptionId(): string {
  return nanoid();
}

/** 生成一个新 Tab id，同样复用 nanoid（预制 Tab 用固定字面量 id，用户自建 Tab 走这里）。 */
export function newTabId(): string {
  return nanoid();
}

/** 生成一个新单选/多选选项 id，同样复用 nanoid。 */
export function newSelectOptionId(): string {
  return nanoid();
}

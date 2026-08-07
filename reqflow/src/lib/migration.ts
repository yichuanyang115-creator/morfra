import { pathExists, readFile, writeFile } from "./fs";
import { schemaPath } from "./paths";
import { legacyEquivalentSchema } from "./schemaDefaults";
import { nextPaletteColor } from "./stagePalette";
import type { Schema, SelectOption } from "../types/schema";

export interface MigrationResult {
  migrated: boolean;
  schema: Schema;
}

/**
 * Phase 19 之前写入的 schema.json 没有 viewPreferences.frozenCount 字段、Phase 21 前
 * 没有 filters 字段、Phase 22 前没有排序字段，读回时按字段逐个补默认值——
 * 本次修改的属性/阶段/Tab/筛选会在下次 mutateSchema 时把补齐后的完整 viewPreferences
 * 一并落盘。
 */
function backfillViewPreferences(schema: Schema): Schema {
  const vp = schema.viewPreferences;
  if (vp.frozenCount !== undefined && vp.filters !== undefined && vp.globalSort !== undefined && vp.stageSorts !== undefined) return schema;
  return {
    ...schema,
    viewPreferences: {
      ...vp,
      frozenCount: vp.frozenCount ?? 0,
      filters: vp.filters ?? [],
      globalSort: vp.globalSort ?? null,
      stageSorts: vp.stageSorts ?? {},
    },
  };
}

/**
 * Phase 30：旧 Schema 的选项可能没有 color。只给缺失值分配稳定色并立即落盘；已有
 * 自定义值（包括旧格式值）不改写，避免全局换色时篡改项目数据。
 */
function backfillColors<T extends { color?: string }>(items: T[]): T[] {
  const used = items.map((item) => item.color);
  let changed = false;
  const next = items.map((item) => {
    if (item.color !== undefined) return item;
    const color = nextPaletteColor(used);
    used.push(color);
    changed = true;
    return { ...item, color };
  });
  return changed ? next : items;
}

function backfillOptionColors(options: SelectOption[] | undefined): SelectOption[] | undefined {
  if (!options) return undefined;
  return backfillColors(options);
}

function backfillSchemaOptionColors(schema: Schema): Schema {
  let changed = false;
  const stageOptions = backfillColors(schema.stageOptions);
  if (stageOptions !== schema.stageOptions) changed = true;
  const attributes = schema.attributes.map((attribute) => {
    const options = backfillOptionColors(attribute.options);
    if (options === attribute.options) return attribute;
    changed = true;
    return { ...attribute, options };
  });
  const tabs = schema.tabs.map((tab) => {
    if (!tab.fields) return tab;
    let tabChanged = false;
    const fields = tab.fields.map((field) => {
      const options = backfillOptionColors(field.options);
      if (options === field.options) return field;
      tabChanged = true;
      return { ...field, options };
    });
    if (!tabChanged) return tab;
    changed = true;
    return { ...tab, fields };
  });
  return changed ? { ...schema, stageOptions, attributes, tabs } : schema;
}

/**
 * 旧项目检测：无 schema.json 即为旧项目（REQ-029）。检测到则用与硬编码字段
 * 等价的 Schema 静默补齐并写入，幂等——已存在 schema.json 时直接读回，不重新生成。
 */
export async function migrateIfNeeded(projectId: string, sources: string[]): Promise<MigrationResult> {
  const path = await schemaPath(projectId);

  if (await pathExists(path)) {
    const raw = await readFile(path);
    const rawSchema = raw ? backfillViewPreferences(JSON.parse(raw) as Schema) : legacyEquivalentSchema(sources);
    const schema = backfillSchemaOptionColors(rawSchema);
    if (schema !== rawSchema) await writeFile(path, JSON.stringify(schema, null, 2));
    return { migrated: false, schema };
  }

  const schema = legacyEquivalentSchema(sources);
  await writeFile(path, JSON.stringify(schema, null, 2));
  return { migrated: true, schema };
}

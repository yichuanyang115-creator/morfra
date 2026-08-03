import { pathExists, readFile, writeFile } from "./fs";
import { schemaPath } from "./paths";
import { legacyEquivalentSchema } from "./schemaDefaults";
import type { Schema } from "../types/schema";

export interface MigrationResult {
  migrated: boolean;
  schema: Schema;
}

/**
 * Phase 19 之前写入的 schema.json 没有 viewPreferences.frozenCount 字段，读回时
 * 补一个默认值 0（未冻结任何列），不重写文件——本次修改的属性/阶段/Tab 会在下次
 * mutateSchema 时把补齐后的完整 viewPreferences 一并落盘。
 */
function backfillViewPreferences(schema: Schema): Schema {
  if (schema.viewPreferences.frozenCount !== undefined) return schema;
  return { ...schema, viewPreferences: { ...schema.viewPreferences, frozenCount: 0 } };
}

/**
 * 旧项目检测：无 schema.json 即为旧项目（REQ-029）。检测到则用与硬编码字段
 * 等价的 Schema 静默补齐并写入，幂等——已存在 schema.json 时直接读回，不重新生成。
 */
export async function migrateIfNeeded(projectId: string, sources: string[]): Promise<MigrationResult> {
  const path = await schemaPath(projectId);

  if (await pathExists(path)) {
    const raw = await readFile(path);
    const schema = raw ? backfillViewPreferences(JSON.parse(raw) as Schema) : legacyEquivalentSchema(sources);
    return { migrated: false, schema };
  }

  const schema = legacyEquivalentSchema(sources);
  await writeFile(path, JSON.stringify(schema, null, 2));
  return { migrated: true, schema };
}

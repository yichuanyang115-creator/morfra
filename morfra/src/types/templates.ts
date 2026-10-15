import type { Schema } from "./schema";

/**
 * 模板只保存 Schema 的结构定义，刻意不携带项目级的列宽、筛选、排序等视图偏好。
 * 实体数据本来不在 Schema 内，因此不会随模板复制。
 */
export type SchemaSnapshot = Omit<Schema, "viewPreferences">;

export interface SchemaTemplate {
  id: string;
  name: string;
  schemaSnapshot: SchemaSnapshot;
}

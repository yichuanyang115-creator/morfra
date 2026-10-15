export interface TableDeletionPreparation {
  commit: () => void | Promise<void>;
  rollback: () => void | Promise<void>;
}

type TableDeletedListener = (tableId: string) => void | TableDeletionPreparation | Promise<void | TableDeletionPreparation>;

const beforeTableDeletedListeners = new Set<TableDeletedListener>();
const tableDeletedListeners = new Set<TableDeletedListener>();

/**
 * 在宿主删除物理表之前执行可失败的级联清理。失败时必须中止物理删除，
 * 避免 AI 会话变成无法再通过 tableId 定位的孤立目录。
 */
export function onBeforeTableDeleted(listener: TableDeletedListener): () => void {
  beforeTableDeletedListeners.add(listener);
  return () => beforeTableDeletedListeners.delete(listener);
}

export async function emitBeforeTableDeleted(tableId: string): Promise<TableDeletionPreparation[]> {
  const preparations: TableDeletionPreparation[] = [];
  try {
    for (const listener of beforeTableDeletedListeners) {
      const preparation = await listener(tableId);
      if (preparation) preparations.push(preparation);
    }
    return preparations;
  } catch (error) {
    for (const preparation of preparations.reverse()) await preparation.rollback();
    throw error;
  }
}

/**
 * 删除跨越宿主表与 AI 会话两个存储边界时的唯一顺序：先清理可失败的 AI
 * 数据，再删除物理表，最后广播给 UI。任何前置失败都会阻止物理表删除。
 */
export async function deleteTableWithLifecycle<T>(tableId: string, deletePhysicalTable: () => Promise<T>, restorePhysicalTable?: () => Promise<void>): Promise<T> {
  const preparations = await emitBeforeTableDeleted(tableId);
  let result: T;
  try {
    result = await deletePhysicalTable();
  } catch (error) {
    for (const preparation of preparations.reverse()) await preparation.rollback();
    throw error;
  }
  try {
    for (const preparation of preparations) await preparation.commit();
  } catch (error) {
    if (!restorePhysicalTable) throw error;
    await restorePhysicalTable();
    for (const preparation of preparations.reverse()) await preparation.rollback();
    throw error;
  }
  await emitTableDeleted(tableId);
  return result;
}

export function onTableDeleted(listener: TableDeletedListener): () => void {
  tableDeletedListeners.add(listener);
  return () => tableDeletedListeners.delete(listener);
}

/**
 * 物理表成功删除后通知 UI 与适配器刷新；可失败的持久化清理由 emitBeforeTableDeleted 处理。
 */
export async function emitTableDeleted(tableId: string): Promise<void> {
  for (const listener of tableDeletedListeners) await listener(tableId);
}

type TableDeletedListener = (tableId: string) => void;

const tableDeletedListeners = new Set<TableDeletedListener>();

export function onTableDeleted(listener: TableDeletedListener): () => void {
  tableDeletedListeners.add(listener);
  return () => tableDeletedListeners.delete(listener);
}

/** Phase 43 的 AI 宿主可订阅；当前没有订阅者时不产生任何副作用。 */
export function emitTableDeleted(tableId: string): void {
  tableDeletedListeners.forEach((listener) => listener(tableId));
}

import { loadAIConversations, deleteTableAIData, stageTableAIDataDeletion } from "./persistence";
import { getRecordTitle, normalizeTableSnapshot } from "./tableSnapshot";
import type { TableDataAdapter, TableEvent, TableSnapshot } from "./tableDataAdapter";

export interface IntegrationCheckResult {
  id: string;
  status: "passed" | "failed";
  detail: string;
}

export interface IntegrationCheckReport {
  passed: boolean;
  checks: IntegrationCheckResult[];
  failures: IntegrationCheckResult[];
}

export interface IntegrationCheckOptions {
  tableId?: string;
  eventProbe?: () => void | Promise<void>;
  afterUnsubscribeProbe?: () => void | Promise<void>;
  aiCoreSources?: Readonly<Record<string, string>>;
}

function pass(id: string, detail: string): IntegrationCheckResult {
  return { id, status: "passed", detail };
}

function fail(id: string, error: unknown): IntegrationCheckResult {
  return { id, status: "failed", detail: error instanceof Error ? error.message : String(error) };
}

function assertSnapshot(snapshot: TableSnapshot, expectedTableId: string): void {
  normalizeTableSnapshot(snapshot);
  if (snapshot.tableId !== expectedTableId) throw new Error(`tableId 不一致：${snapshot.tableId}`);
  const fieldIds = new Set(snapshot.fields.map((field) => field.id));
  if (fieldIds.size !== snapshot.fields.length) throw new Error("字段 ID 不稳定或重复");
  if (!fieldIds.has(snapshot.primaryTitleFieldId)) throw new Error("主标题字段不存在");
  const recordIds = new Set<string>();
  for (const record of snapshot.records) {
    if (recordIds.has(record.id)) throw new Error(`recordId 重复：${record.id}`);
    recordIds.add(record.id);
    if (Object.keys(record.values).some((fieldId) => !fieldIds.has(fieldId))) throw new Error(`记录 ${record.id} 含未声明字段`);
    if (getRecordTitle(snapshot, record.id).trim().length === 0) throw new Error(`记录 ${record.id} 没有可引用标题`);
  }
  if (Number.isNaN(Date.parse(snapshot.capturedAt))) throw new Error("capturedAt 不是有效时间");
}

function assertStableIdentity(first: TableSnapshot, second: TableSnapshot): void {
  if (first.tableId !== second.tableId) throw new Error("连续快照的 tableId 不一致");
  if (first.primaryTitleFieldId !== second.primaryTitleFieldId) throw new Error("连续快照的主标题字段不一致");
  const firstRecordIds = [...first.records.map((record) => record.id)].sort();
  const secondRecordIds = [...second.records.map((record) => record.id)].sort();
  if (JSON.stringify(firstRecordIds) !== JSON.stringify(secondRecordIds)) {
    throw new Error("连续快照的 recordId 集合不一致");
  }
}

function assertDependencyDirection(sources: Readonly<Record<string, string>>): void {
  const forbiddenImport = /from\s+["'][^"']*(?:\/stores\/(?:projectStore|requirementStore|schemaStore)|\/components\/detail(?:\/|["'])|\/lib\/paths["'])/u;
  for (const [file, source] of Object.entries(sources)) {
    if (forbiddenImport.test(source)) throw new Error(`AI Core 反向依赖主产品：${file}`);
  }
}

export async function runIntegrationChecks(
  adapter: TableDataAdapter,
  options: IntegrationCheckOptions = {},
): Promise<IntegrationCheckReport> {
  const results: IntegrationCheckResult[] = [];
  const active = adapter.getActiveTable();
  const tableId = options.tableId ?? active?.tableId;

  if (!tableId) {
    results.push(fail("active-table", "没有可验证的当前表"));
  } else {
    results.push(active?.tableId === tableId ? pass("table-id", `当前表稳定 ID：${tableId}`) : fail("table-id", "当前表 ID 与请求表不一致"));
    try {
      const first = await adapter.getTableSnapshot(tableId);
      assertSnapshot(first, tableId);
      results.push(pass("snapshot-contract", `快照 ${first.tableId} 包含 ${first.fields.length} 个字段、${first.records.length} 条记录`));

      const selected = adapter.getSelectedRecordIds(tableId);
      const recordIds = new Set(first.records.map((record) => record.id));
      if (selected.some((recordId) => !recordIds.has(recordId))) throw new Error("选择范围包含当前快照之外的记录");
      results.push(pass("selection-range", `当前选择 ${selected.length} 条，均属于表 ${tableId}`));

      const second = await adapter.getTableSnapshot(tableId);
      assertStableIdentity(first, second);
      results.push(pass("snapshot-consistency", `Schema、主标题和 recordId 在连续快照间一致`));
    } catch (error) {
      results.push(fail("snapshot-contract", error));
    }
  }

  try {
    let eventCount = 0;
    const unsubscribe = adapter.subscribe((event: TableEvent) => {
      eventCount += 1;
      if (!event.type) throw new Error("事件缺少 type");
    });
    if (typeof unsubscribe !== "function") throw new Error("subscribe 没有返回退订函数");
    if (options.eventProbe) await options.eventProbe();
    if (options.eventProbe && eventCount === 0) throw new Error("事件订阅没有收到宿主变化");
    const countBeforeUnsubscribe = eventCount;
    unsubscribe();
    if (options.afterUnsubscribeProbe) await options.afterUnsubscribeProbe();
    if (eventCount !== countBeforeUnsubscribe) throw new Error("退订后仍收到事件");
    results.push(pass("event-subscription", options.eventProbe ? `收到 ${eventCount} 个事件并验证退订` : "订阅与退订接口可用"));
  } catch (error) {
    results.push(fail("event-subscription", error));
  }

  if (options.aiCoreSources) {
    try {
      assertDependencyDirection(options.aiCoreSources);
      results.push(pass("dependency-direction", `检查 ${Object.keys(options.aiCoreSources).length} 个 AI Core 源文件`));
    } catch (error) {
      results.push(fail("dependency-direction", error));
    }
  }

  const failures = results.filter((result) => result.status === "failed");
  return { passed: failures.length === 0, checks: results, failures };
}

export async function deleteTableAIDataAndVerify(tableId: string): Promise<void> {
  await deleteTableAIData(tableId);
  const remaining = await loadAIConversations(tableId);
  if (remaining.value.length > 0 || remaining.issues.length > 0) {
    throw new Error(`表 ${tableId} 删除后仍有 AI 会话或存储问题`);
  }
}

export async function prepareTableAIDataDeletion(tableId: string) {
  return stageTableAIDataDeletion(tableId);
}

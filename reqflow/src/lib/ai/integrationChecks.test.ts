import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEvaluationTableAdapter } from "../../fixtures/aiEvaluationTables";

const { files, removeMock } = vi.hoisted(() => ({
  files: new Map<string, string>(),
  removeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "/app-local-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => files.has(path) || [...files.keys()].some((candidate) => candidate.startsWith(`${path}/`))),
  readDir: vi.fn(async () => []),
  readTextFile: vi.fn(async (path: string) => files.get(path) ?? ""),
  remove: removeMock.mockImplementation(async (path: string, options?: { recursive?: boolean }) => {
    if (options?.recursive) {
      for (const candidate of [...files.keys()]) {
        if (candidate === path || candidate.startsWith(`${path}/`)) files.delete(candidate);
      }
      return;
    }
    files.delete(path);
  }),
  mkdir: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  writeTextFile: vi.fn(async () => undefined),
}));

const { runIntegrationChecks, deleteTableAIDataAndVerify } = await import("./integrationChecks");
const aiCoreSources = import.meta.glob("./*.ts", { eager: true, import: "default", query: "?raw" }) as Record<string, string>;

describe("AI Phase 7 接入契约断言", () => {
  beforeEach(() => {
    files.clear();
    removeMock.mockClear();
  });

  it("运行 tableId、recordId、主标题、快照、选择、事件和依赖方向检查", async () => {
    const controls = createEvaluationTableAdapter();
    const report = await runIntegrationChecks(controls.adapter, {
      tableId: "table-delivery",
      eventProbe: () => {
        controls.setActiveTable("table-budget");
        controls.setActiveTable("table-delivery");
      },
      afterUnsubscribeProbe: () => controls.setSelectedRecordIds("table-delivery", ["delivery-1"]),
      aiCoreSources: {
        "chatOrchestrator.ts": aiCoreSources["./chatOrchestrator.ts"],
        "contextBuilder.ts": aiCoreSources["./contextBuilder.ts"],
        "evaluationRunner.ts": aiCoreSources["./evaluationRunner.ts"],
      },
    });

    expect(report.failures).toEqual([]);
    expect(report.checks.map((check) => check.id)).toEqual([
      "table-id",
      "snapshot-contract",
      "selection-range",
      "snapshot-consistency",
      "event-subscription",
      "dependency-direction",
    ]);
  });

  it("表删除只调用精确 tableId 级联清理，删除后不遗留孤立会话", async () => {
    const tableAConversation = "/app-local-data/ai/tables/table-a/conversations/a.md";
    const tableBConversation = "/app-local-data/ai/tables/table-b/conversations/b.md";
    files.set(tableAConversation, "orphan candidate");
    files.set(tableBConversation, "other table");

    await deleteTableAIDataAndVerify("table-a");

    expect(files.has(tableAConversation)).toBe(false);
    expect(files.get(tableBConversation)).toBe("other table");
    expect(removeMock).toHaveBeenCalledWith("/app-local-data/ai/tables/table-a", { recursive: true });
    expect(removeMock).not.toHaveBeenCalledWith("/app-local-data/ai/tables", { recursive: true });
  });
});

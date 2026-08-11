import { describe, expect, it, vi } from "vitest";
import { createEvaluationTableAdapter } from "./aiEvaluationTables";
import { AI_PHASE_7_EVALUATION_CASES, runPhase7EvaluationSet } from "./aiEvaluationCases";
import { evaluateAIAdapter } from "../lib/ai/evaluation";
import { createAIConversationStore, type AIConversationPersistence } from "../stores/aiConversationStore";
import { deleteTableAIDataAndVerify } from "../lib/ai/integrationChecks";
import { deleteTableWithLifecycle, onBeforeTableDeleted, onTableDeleted } from "../lib/tableLifecycleEvents";
import type { AIConversation } from "../types/ai";

const fsMock = vi.hoisted(() => ({ files: new Map<string, string>() }));

vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "/app-local-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => fsMock.files.has(path) || [...fsMock.files.keys()].some((candidate) => candidate.startsWith(`${path}/`))),
  readDir: vi.fn(async (path: string) => [...fsMock.files.keys()].filter((candidate) => candidate.startsWith(`${path}/`)).map((candidate) => ({ name: candidate.slice(path.length + 1), isFile: true, isDirectory: false, isSymlink: false }))),
  readTextFile: vi.fn(async (path: string) => fsMock.files.get(path) ?? ""),
  remove: vi.fn(async (path: string, options?: { recursive?: boolean }) => {
    if (options?.recursive) for (const candidate of [...fsMock.files.keys()]) if (candidate === path || candidate.startsWith(`${path}/`)) fsMock.files.delete(candidate);
    else fsMock.files.delete(path);
  }),
  mkdir: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  writeTextFile: vi.fn(async () => undefined),
}));

function memoryPersistence(): AIConversationPersistence {
  const conversations = new Map<string, Map<string, AIConversation>>();
  const current = new Map<string, string | null>();
  return {
    loadAIConversationIndex: async (tableId) => ({ value: { version: 1, tableId, currentConversationId: current.get(tableId) ?? null, conversations: [...(conversations.get(tableId)?.values() ?? [])].map(({ messages: _messages, ...entry }) => entry) }, issues: [] }),
    loadAIConversations: async (tableId) => ({ value: [...(conversations.get(tableId)?.values() ?? [])].map((conversation) => structuredClone(conversation)), issues: [] }),
    saveAIConversation: async (conversation, makeCurrent = false) => {
      const table = conversations.get(conversation.tableId) ?? new Map<string, AIConversation>();
      table.set(conversation.id, structuredClone(conversation));
      conversations.set(conversation.tableId, table);
      if (makeCurrent) current.set(conversation.tableId, conversation.id);
    },
    deleteAIConversation: async (tableId, conversationId) => { conversations.get(tableId)?.delete(conversationId); },
    clearAllAIConversationData: async () => { conversations.clear(); current.clear(); },
  };
}

describe("AI Phase 7 固定评估集", () => {
  it("逐项执行精确计算、错误矩阵、路由、重启、删除级联和隐私检查", async () => {
    const expectedIds = [
      "count", "percentage", "sum", "average", "group", "sort", "null",
      "invalid-field", "invalid-operation", "model-incompatible", "insufficient-data",
      "full-table", "selected-records", "selection-not-referenced", "general-none",
      "record-references", "cross-table-isolation", "restart-restore", "delete-cascade", "key-privacy",
    ];
    expect(AI_PHASE_7_EVALUATION_CASES.map((testCase) => testCase.id)).toEqual(expectedIds);

    fsMock.files.clear();
    const persistence = memoryPersistence();
    const beforeCleanup = onBeforeTableDeleted(async (tableId) => deleteTableAIDataAndVerify(tableId));
    const afterDelete = onTableDeleted(() => undefined);
    fsMock.files.set("/app-local-data/ai/tables/table-evaluation/conversations/session.md", "session");
    const persistedSources = import.meta.glob("../{adapters/ai,components/chat,components/storage,fixtures,lib/ai,stores}/**/*.{ts,tsx}", { eager: true, import: "default", query: "?raw" }) as Record<string, string>;
    const catalogReport = await runPhase7EvaluationSet({
      "restart-restore": async () => {
        const first = createAIConversationStore({ persistence, createId: () => "conversation-restart" });
        await first.getState().loadTable("table-restart");
        await first.getState().createConversation({ tableId: "table-restart", mode: "general", providerConfigId: "provider", modelId: "model" });
        const restarted = createAIConversationStore({ persistence });
        await restarted.getState().loadTable("table-restart");
        expect(restarted.getState().getCurrentConversation("table-restart")?.id).toBe("conversation-restart");
      },
      "delete-cascade": async () => {
        await deleteTableWithLifecycle("table-evaluation", async () => "physical-table-deleted");
        expect(fsMock.files.has("/app-local-data/ai/tables/table-evaluation/conversations/session.md")).toBe(false);
      },
      "key-privacy": () => {
        const persistedCode = Object.entries(persistedSources).filter(([path]) => /(?:persistence|current(?:Project|Storage)TableAdapter|legacyChat|ChatPanel|StorageAIHost|aiConversationStore)\.(?:ts|tsx)$/u.test(path)).map(([, source]) => source).join("\n");
        expect(persistedCode).not.toMatch(/(?:Authorization\\s*:|apiKey\\s*:|OPENAI_API_KEY|ANTHROPIC_API_KEY|VITE_[A-Z0-9_]*(?:KEY|SECRET|TOKEN))/u);
      },
    });
    beforeCleanup();
    afterDelete();
    expect(catalogReport.failures).toEqual([]);
    expect(catalogReport.passed).toBe(catalogReport.total);

    const adapterReport = await evaluateAIAdapter(createEvaluationTableAdapter().adapter);
    expect(adapterReport.failures).toEqual([]);
    expect(adapterReport.passed).toBe(adapterReport.total);
  });
});

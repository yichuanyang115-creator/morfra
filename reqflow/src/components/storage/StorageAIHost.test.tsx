import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorageAIHost } from "./StorageAIHost";
import { useAIConversationStore } from "../../stores/aiConversationStore";
import { useAIProviderStore } from "../../stores/aiProviderStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { useProjectStore } from "../../stores/projectStore";
import { useStorageSelectionStore } from "../../stores/storageSelectionStore";
import { useTableDataStore } from "../../stores/tableDataStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";

const files = new Map<string, string>();

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => files.has(path)),
  readTextFile: vi.fn(async (path: string) => files.get(path) ?? ""),
  writeTextFile: vi.fn(async (path: string, content: string) => { files.set(path, content); }),
  mkdir: vi.fn(async () => undefined),
  rename: vi.fn(async (from: string, to: string) => { const content = files.get(from); if (content === undefined) throw new Error("missing source"); files.set(to, content); files.delete(from); }),
  readDir: vi.fn(async () => []),
  remove: vi.fn(async () => undefined),
}));
vi.mock("@tauri-apps/api/path", () => ({ appLocalDataDir: vi.fn(async () => "/app-local-data"), join: vi.fn(async (...parts: string[]) => parts.join("/")) }));

const provider = { id: "provider-1", name: "本地兼容服务", baseUrl: "https://example.test/v1", defaultModelId: "model-a", cachedModelIds: ["model-a"], capabilityStatus: "available" as const, createdAt: "2026-08-10", updatedAt: "2026-08-10" };

describe("StorageAIHost 生产宿主", () => {
  beforeEach(() => {
    files.clear();
    useProjectStore.setState({ projects: [{ id: "project-a", name: "生产项目", sources: [], storageSnapshot: { manifest: { id: "project-a", name: "生产项目", formatVersion: 3, createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z" }, tables: [{ id: "table-a", name: "真实表", position: 0, titleFieldId: "name", recordCount: 1, views: [] }] } }], currentProjectId: "project-a" });
    useWorkspaceStore.setState({ activeTableByProject: { "project-a": "table-a" } });
    useTableDataStore.setState({ dataByTable: { "table-a": { tableId: "table-a", groups: [], fields: [{ id: "name", tableId: "table-a", groupId: null, name: "Name", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] }], records: [{ id: "record-a", tableId: "table-a", position: 0, autoNumber: 1, createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z", values: { name: "生产记录" }, multiSelectValues: {} }] } } });
    useStorageSelectionStore.setState({ selectedRecordByTable: { "table-a": "record-a" }, selectedRecordIdsByTable: { "table-a": ["record-a"] } });
    useLayoutStore.setState({ detailOpen: false, activeRightPanel: "ai" });
    useAIProviderStore.setState({ configs: [provider], secretStatus: { "provider-1": true }, defaultProviderConfigId: "provider-1", lastProviderConfigId: "provider-1", lastModelId: "model-a", modelIds: { "provider-1": ["model-a"] }, dataExfiltrationConfirmed: true, loaded: true });
    useAIConversationStore.setState({ conversationsByTable: {}, currentConversationIdByTable: {}, loadedTables: { "table-a": true }, loadingTables: {}, activeRequests: {}, persistenceError: null });
  });

  it("将真实 Storage 表传给 Phase 6 ChatPanel，而非 AI 占位宿主", async () => {
    render(<StorageAIHost />);

    await waitFor(() => expect(screen.getByTestId("chat-context-bar")).toBeInTheDocument());
    expect(screen.getAllByText("真实表")).toHaveLength(2);
    expect(screen.getByRole("form", { name: "AI 输入" })).toBeInTheDocument();
    expect(screen.queryByText("AI 工作区宿主")).not.toBeInTheDocument();
  });

});

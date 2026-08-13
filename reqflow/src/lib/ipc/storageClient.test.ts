import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { createStorageProject, getStorageDetailTabs, loadStorageRecordDetailContent, openStorageProject, saveStorageRecordDetailContent, updateStorageTableEmoji } from "./storageClient";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("storageClient", () => {
  beforeEach(() => vi.mocked(invoke).mockReset());

  it("returns the typed project snapshot from create and open commands", async () => {
    const snapshot = {
      manifest: {
        id: "project-1",
        name: "本地项目",
        formatVersion: 1,
        createdAt: "1",
        updatedAt: "1",
      },
      tables: [
        {
          id: "table-1",
          name: "未命名表",
          emoji: "📋",
          position: 0,
          titleFieldId: "field-1",
          recordCount: 0,
          views: [{ id: "view-1", name: "表格", viewType: "table", position: 0 }],
        },
      ],
    };
    vi.mocked(invoke).mockResolvedValue(snapshot);

    await expect(createStorageProject({ path: "/tmp/morfra", name: "本地项目" })).resolves.toEqual(snapshot);
    await expect(openStorageProject("/tmp/morfra")).resolves.toEqual(snapshot);
    expect(vi.mocked(invoke)).toHaveBeenNthCalledWith(1, "storage_create_project", {
      path: "/tmp/morfra",
      name: "本地项目",
    });
    expect(vi.mocked(invoke)).toHaveBeenNthCalledWith(2, "storage_open_project", {
      path: "/tmp/morfra",
    });
    await createStorageProject({ path: "/tmp/requirements", name: "需求项目", template: "requirements" });
    expect(vi.mocked(invoke)).toHaveBeenNthCalledWith(3, "storage_create_project", { path: "/tmp/requirements", name: "需求项目", template: "requirements" });
  });

  it("updates a table Emoji through the typed lifecycle command", async () => {
    vi.mocked(invoke).mockResolvedValue({ manifest: {}, tables: [] });

    await updateStorageTableEmoji("table-1", "🚀");

    expect(vi.mocked(invoke)).toHaveBeenCalledWith("storage_update_table_emoji", {
      tableId: "table-1",
      emoji: "🚀",
    });
  });

  it("uses typed record-detail commands for the fixed requirement tabs", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await getStorageDetailTabs("table-1");
    await loadStorageRecordDetailContent("record-1");
    const content = { body: "背景", deliverables: [], tasks: [], acceptance: [] };
    await saveStorageRecordDetailContent("record-1", content);
    expect(vi.mocked(invoke)).toHaveBeenNthCalledWith(1, "storage_get_detail_tabs", { tableId: "table-1" });
    expect(vi.mocked(invoke)).toHaveBeenNthCalledWith(2, "storage_load_record_detail_content", { recordId: "record-1" });
    expect(vi.mocked(invoke)).toHaveBeenNthCalledWith(3, "storage_save_record_detail_content", { recordId: "record-1", content });
  });
});

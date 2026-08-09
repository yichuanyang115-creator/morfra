import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { createStorageProject, openStorageProject } from "./storageClient";

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
  });
});

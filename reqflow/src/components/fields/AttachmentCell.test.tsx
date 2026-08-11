import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pick: vi.fn(), add: vi.fn(), list: vi.fn(), remove: vi.fn(), path: vi.fn(), openPath: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.pick }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openPath: mocks.openPath }));
vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: (path: string) => `asset://${path}` }));
vi.mock("../../lib/ipc/storageClient", () => ({ addStorageAttachment: mocks.add, listStorageAttachments: mocks.list, removeStorageAttachment: mocks.remove, storageAttachmentPath: mocks.path }));
import { AttachmentCell } from "./AttachmentCell";

describe("AttachmentCell", () => {
  beforeEach(() => { Object.values(mocks).forEach((mock) => mock.mockReset()); mocks.list.mockResolvedValue([]); });
  it("copies a selected local file through storage IPC then refreshes the table", async () => {
    mocks.pick.mockResolvedValue("/outside/design.png"); mocks.add.mockResolvedValue({ id: "a1" }); const changed = vi.fn().mockResolvedValue(undefined);
    render(<AttachmentCell recordId="r1" fieldId="f1" image onChanged={changed} />);
    await userEvent.click(await screen.findByRole("button", { name: "添加附件" }));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith("r1", "f1", "/outside/design.png"));
    expect(changed).toHaveBeenCalled();
  });
  it("keeps a retryable local error when copying fails", async () => {
    mocks.pick.mockResolvedValue("/outside/missing.pdf"); mocks.add.mockRejectedValue(new Error("项目文件操作失败，请检查文件夹权限"));
    render(<AttachmentCell recordId="r1" fieldId="f1" image={false} onChanged={vi.fn().mockResolvedValue(undefined)} />);
    await userEvent.click(await screen.findByRole("button", { name: "添加附件" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("项目文件操作失败，请检查文件夹权限");
    expect(screen.getByRole("button", { name: "重试" })).toBeVisible();
  });
});

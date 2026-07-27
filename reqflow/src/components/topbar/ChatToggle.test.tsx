import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatToggle } from "./ChatToggle";

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => ""),
  writeTextFile: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "/app-local-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

const { useChatStore } = await import("../../stores/chatStore");

describe("ChatToggle（REQ-024 v2.8：独立第三栏，开关始终可点击，不再有置灰态）", () => {
  beforeEach(() => {
    useChatStore.setState({ open: false, messages: [], thinking: false, loadedProjectId: "proj-1" });
  });

  it("按钮始终可点击，不受空间是否充足影响（v2.7 遗留的置灰规则已被 v2.8 移除）", () => {
    render(<ChatToggle />);
    expect(screen.getByRole("button", { name: "打开对话框" })).not.toBeDisabled();
  });

  it("点击按钮切换开关状态（关→开）", async () => {
    render(<ChatToggle />);
    await userEvent.click(screen.getByRole("button", { name: "打开对话框" }));

    expect(useChatStore.getState().open).toBe(true);
  });

  it("开关已打开时按钮 aria-label 变为「关闭对话框」，再点击切回关闭", async () => {
    useChatStore.setState({ open: true });
    render(<ChatToggle />);

    const button = screen.getByRole("button", { name: "关闭对话框" });
    await userEvent.click(button);

    expect(useChatStore.getState().open).toBe(false);
  });
});

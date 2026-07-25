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

describe("ChatToggle（REQ-024 v2.7：顶栏手动开关）", () => {
  beforeEach(() => {
    useChatStore.setState({ open: false, messages: [], thinking: false, loadedProjectId: "proj-1" });
  });

  it("空间足够时按钮可点击，未置灰", () => {
    render(<ChatToggle spaceAvailable={true} />);
    expect(screen.getByRole("button", { name: "打开对话框" })).not.toBeDisabled();
  });

  it("空间不足时按钮置灰不可点，带有拖宽提示文案", () => {
    render(<ChatToggle spaceAvailable={false} />);
    const button = screen.getByRole("button", { name: "打开对话框" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "拖宽详情面板后可使用");
  });

  it("点击按钮切换开关状态（关→开）", async () => {
    render(<ChatToggle spaceAvailable={true} />);
    await userEvent.click(screen.getByRole("button", { name: "打开对话框" }));

    expect(useChatStore.getState().open).toBe(true);
  });

  it("开关已打开时按钮 aria-label 变为「关闭对话框」，再点击切回关闭", async () => {
    useChatStore.setState({ open: true });
    render(<ChatToggle spaceAvailable={true} />);

    const button = screen.getByRole("button", { name: "关闭对话框" });
    await userEvent.click(button);

    expect(useChatStore.getState().open).toBe(false);
  });

  it("空间不足时点击（模拟强行触发）不会改变开关状态，disabled 按钮天然拦截点击", async () => {
    render(<ChatToggle spaceAvailable={false} />);
    const button = screen.getByRole("button", { name: "打开对话框" });

    await userEvent.click(button);

    expect(useChatStore.getState().open).toBe(false);
  });
});

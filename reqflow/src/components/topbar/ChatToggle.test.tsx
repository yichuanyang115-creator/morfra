import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAIProviderStore } from "../../stores/aiProviderStore";
import { ChatToggle } from "./ChatToggle";

vi.mock("@tauri-apps/plugin-fs", () => ({ exists: vi.fn(async () => false), readTextFile: vi.fn(async () => ""), writeTextFile: vi.fn(async () => undefined), mkdir: vi.fn(async () => undefined) }));
vi.mock("@tauri-apps/api/path", () => ({ appLocalDataDir: vi.fn(async () => "/app-local-data"), join: vi.fn(async (...parts: string[]) => parts.join("/")) }));

describe("ChatToggle Phase 6", () => {
  beforeEach(() => {
    useAIProviderStore.setState({ panelOpen: false, panelWidth: 360, loaded: true });
  });

  it("使用 AI 应用级偏好控制开关，按钮始终可访问", () => {
    render(<ChatToggle />);
    const button = screen.getByRole("button", { name: "打开 AI 面板" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("点击切换面板并更新应用级状态", () => {
    render(<ChatToggle />);
    fireEvent.click(screen.getByRole("button", { name: "打开 AI 面板" }));
    expect(useAIProviderStore.getState().panelOpen).toBe(true);
  });

  it("生成完成时收起面板显示非打断式状态提示", async () => {
    render(<ChatToggle />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("ai-generation-completed"));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "打开 AI 面板" }).querySelector("[role=status]")).toBeInTheDocument());
  });
});

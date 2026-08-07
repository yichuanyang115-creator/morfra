import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatPanel } from "./ChatPanel";

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

describe("ChatPanel（REQ-024 详情面板对话框，假数据）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useChatStore.setState({ open: true, messages: [], thinking: false, loadedProjectId: "proj-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("width 为 null 时不渲染任何内容（剩余空间不足）", () => {
    const { container } = render(<ChatPanel width={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("width 非 null 时渲染对话区，宽度应用到根容器", () => {
    const { container } = render(<ChatPanel width={300} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.style.width).toBe("300px");
    expect(root).toHaveClass("theme-module-chat");
    expect(screen.getByRole("log", { name: "对话消息" })).toHaveAttribute("aria-live", "polite");
  });

  it("空消息不触发发送：输入框只有空格时发送按钮禁用", () => {
    render(<ChatPanel width={300} />);
    const textarea = screen.getByPlaceholderText("输入消息，回车发送…");
    fireEvent.change(textarea, { target: { value: "   " } });

    const sendButton = screen.getByRole("button", { name: "发送" });
    expect(sendButton).toBeDisabled();
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it("回车发送非空消息：立即显示用户消息和思考中提示，延迟后显示固定回复", async () => {
    render(<ChatPanel width={300} />);
    const textarea = screen.getByPlaceholderText("输入消息，回车发送…");

    fireEvent.change(textarea, { target: { value: "你好" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(screen.getByText("你好")).toBeInTheDocument();
    const userMessage = screen.getByText("你好").closest("[data-role=\"user\"]");
    expect(userMessage).toHaveAttribute("aria-label", "用户消息");
    expect(userMessage).toHaveClass("self-end", "bg-(--module-scope-context-soft)", "text-(--module-scope-action-strong)");
    expect(screen.getByLabelText("对话运行中")).toHaveClass("self-start", "bg-transparent", "text-(--module-scope-context-strong)");
    expect(screen.getByLabelText("对话运行中").querySelectorAll(".bg-\\(--module-scope-context-strong\\)")).toHaveLength(3);
    expect(screen.getByText("思考中…")).toBeInTheDocument();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.queryByText("思考中…")).not.toBeInTheDocument();
    expect(useChatStore.getState().messages).toHaveLength(2);
    expect(screen.getByText("这个功能还在开发中，暂时只能陪你聊聊。")).toHaveAttribute("aria-label", "AI 消息");
    expect(screen.getByText("这个功能还在开发中，暂时只能陪你聊聊。")).toHaveClass("self-start", "bg-transparent", "text-(--module-scope-text-primary)");
  });

  it("点击发送按钮发送消息，效果与回车一致", () => {
    render(<ChatPanel width={300} />);
    const textarea = screen.getByPlaceholderText("输入消息，回车发送…");

    fireEvent.change(textarea, { target: { value: "点击发送" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(screen.getByText("点击发送")).toBeInTheDocument();
    expect(useChatStore.getState().messages).toHaveLength(1);
  });

  it("发送后输入框清空", () => {
    render(<ChatPanel width={300} />);
    const textarea = screen.getByPlaceholderText("输入消息，回车发送…") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "清空测试" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(textarea.value).toBe("");
  });

  it("Shift+Enter 换行不发送消息", () => {
    render(<ChatPanel width={300} />);
    const textarea = screen.getByPlaceholderText("输入消息，回车发送…");

    fireEvent.change(textarea, { target: { value: "换行内容" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it("点击清空对话按钮清空全部消息", async () => {
    useChatStore.setState({
      messages: [
        { id: "1", role: "user", content: "旧消息" },
        { id: "2", role: "assistant", content: "旧回复" },
      ],
    });
    render(<ChatPanel width={300} />);
    expect(screen.getByText("旧消息")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "清空对话" }));
      await vi.runAllTimersAsync();
    });

    expect(screen.queryByText("旧消息")).not.toBeInTheDocument();
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it("思考中点击清空后，延迟假回复不会重新写回", async () => {
    render(<ChatPanel width={300} />);
    const textarea = screen.getByPlaceholderText("输入消息，回车发送…");
    fireEvent.change(textarea, { target: { value: "待清空" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "清空对话" }));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(screen.getByText("随便聊点什么…")).toBeInTheDocument();
  });

  it("消息为空且未在思考时显示空状态提示文案", () => {
    render(<ChatPanel width={300} />);
    expect(screen.getByText("随便聊点什么…")).toBeInTheDocument();
  });
});

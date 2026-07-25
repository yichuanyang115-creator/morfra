import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "./chatStore";

describe("chatStore（REQ-024 详情面板对话框，假数据）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useChatStore.setState({ messages: [], thinking: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sendMessage 立即落一条 user 消息，进入思考态", () => {
    useChatStore.getState().sendMessage("你好");

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({ role: "user", content: "你好" });
    expect(state.thinking).toBe(true);
  });

  it("思考延迟结束后追加固定文案的 assistant 消息，思考态结束", () => {
    useChatStore.getState().sendMessage("你好");

    vi.runAllTimers();

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1].role).toBe("assistant");
    expect(state.messages[1].content).not.toBe("");
    expect(state.thinking).toBe(false);
  });

  it("不同输入内容的固定回复文案完全一致，证明回复与输入无关（REQ-024 MUST NOT 接入真实 AI）", () => {
    useChatStore.getState().sendMessage("第一条消息");
    vi.runAllTimers();
    const firstReply = useChatStore.getState().messages[1].content;

    useChatStore.getState().sendMessage("内容完全不同的第二条消息");
    vi.runAllTimers();
    const secondReply = useChatStore.getState().messages[3].content;

    expect(firstReply).toBe(secondReply);
  });

  it("空消息（仅空格/仅回车）不发送，不产生任何消息", () => {
    useChatStore.getState().sendMessage("   ");

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(0);
    expect(state.thinking).toBe(false);
  });

  it("clearChat 清空全部消息并重置思考态", () => {
    useChatStore.getState().sendMessage("你好");
    expect(useChatStore.getState().messages).toHaveLength(1);

    useChatStore.getState().clearChat();

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(0);
    expect(state.thinking).toBe(false);
  });

  it("单条消息不限制字数上限，超长文本原样落入 user 消息", () => {
    const longText = "a".repeat(5000);
    useChatStore.getState().sendMessage(longText);

    expect(useChatStore.getState().messages[0].content).toBe(longText);
  });
});

import { describe, expect, it } from "vitest";
import type { AIConversation } from "../../types/ai";
import { answerBlocksText, appendStreamingDelta, createMessage, recoverInterruptedConversation, updateMessage } from "./messagePersistence";

function conversation(): AIConversation {
  return {
    id: "conversation-1",
    tableId: "table-a",
    mode: "general",
    title: "通用对话",
    providerConfigId: "provider-1",
    modelId: "model-1",
    messages: [
      createMessage({ id: "user-1", conversationId: "conversation-1", role: "user", content: "你好", contextRef: { type: "none" }, providerConfigId: "provider-1", modelId: "model-1", status: "complete" }),
      createMessage({ id: "assistant-1", conversationId: "conversation-1", role: "assistant", content: "已", contextRef: { type: "none" }, providerConfigId: "provider-1", modelId: "model-1", status: "streaming" }),
    ],
    createdAt: "2026-08-08T08:00:00.000Z",
    updatedAt: "2026-08-08T08:00:00.000Z",
  };
}

describe("AI 消息持久化边界", () => {
  it("流式片段追加、停止和失败都只改变目标消息", () => {
    const streaming = appendStreamingDelta(conversation(), "assistant-1", "迟到前");
    expect(streaming.messages[1]?.contentBlocks).toEqual([{ type: "markdown", markdown: "已迟到前" }]);
    const stopped = updateMessage(streaming, "assistant-1", { status: "stopped" });
    expect(stopped.messages[1]?.status).toBe("stopped");
    const failed = updateMessage(stopped, "assistant-1", { status: "failed", errorMessage: "请求失败" });
    expect(failed.messages[0]?.contentBlocks).toEqual([{ type: "markdown", markdown: "你好" }]);
    expect(failed.messages[1]?.errorMessage).toBe("请求失败");
  });

  it("应用重启后把 pending/streaming 收口为 stopped，并保留已收到内容", () => {
    const recovered = recoverInterruptedConversation(conversation());
    expect(recovered.changed).toBe(true);
    expect(recovered.conversation.messages[1]?.status).toBe("stopped");
    expect(recovered.conversation.messages[1]?.contentBlocks).toEqual([{ type: "markdown", markdown: "已" }]);
  });

  it("复制消息时包含 Markdown、指标、表格和记录引用，不丢结构化回答", () => {
    const text = answerBlocksText([
      { type: "markdown", markdown: "结论" },
      { type: "metrics", items: [{ label: "总数", value: 3 }] },
      { type: "table", columns: [{ id: "title", label: "事项" }], rows: [{ title: "领域契约" }] },
      { type: "recordRefs", records: [{ recordId: "record-1", title: "领域契约" }] },
    ]);
    expect(text).toContain("结论");
    expect(text).toContain("总数: 3");
    expect(text).toContain("事项\n领域契约");
    expect(text).toContain("领域契约 (record-1)");
  });
});

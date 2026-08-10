import { describe, expect, it, vi } from "vitest";
import { fallbackConversationTitle, generateConversationTitle } from "./titleGenerator";

describe("AI 会话标题", () => {
  it("首条问题过长时截断为稳定回退标题", () => {
    expect(fallbackConversationTitle("  这是一个非常非常长的首条有效问题，用来验证标题截断行为  ", 12)).toBe("这是一个非常非常长的首条有效问题，用来验证标题截断行为".slice(0, 11) + "…");
  });

  it("模型标题成功时使用模型标题，失败或空标题时静默回退", async () => {
    await expect(generateConversationTitle("分析这张表")).resolves.toBe("分析这张表");
    await expect(generateConversationTitle("首条问题", vi.fn(async () => "  表格状态  "))).resolves.toBe("表格状态");
    await expect(generateConversationTitle("首条问题", vi.fn(async () => { throw new Error("provider failed"); }))).resolves.toBe("首条问题");
    await expect(generateConversationTitle("首条问题", vi.fn(async () => "   "))).resolves.toBe("首条问题");
  });
});

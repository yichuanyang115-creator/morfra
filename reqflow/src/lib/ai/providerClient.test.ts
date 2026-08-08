import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  channel: undefined as { onmessage: (event: unknown) => void } | undefined,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: coreMocks.invoke,
  Channel: class MockChannel {
    onmessage: (event: unknown) => void;
    constructor(onmessage: (event: unknown) => void) {
      this.onmessage = onmessage;
      coreMocks.channel = this;
    }
  },
}));

const { cancelAIChat, listAIModels, startAIChat, toAIProviderError } = await import("./providerClient");

describe("providerClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coreMocks.channel = undefined;
  });

  it("只通过 Rust 命令请求模型，不把 Key 放进前端参数", async () => {
    coreMocks.invoke.mockResolvedValueOnce({ modelIds: ["model-a"], source: "remote" });
    await expect(listAIModels({ providerConfigId: "provider-a", baseUrl: "https://example.test/v1", dataExfiltrationConfirmed: true })).resolves.toEqual({ modelIds: ["model-a"], source: "remote" });
    expect(coreMocks.invoke).toHaveBeenCalledWith("list_ai_models", expect.objectContaining({ providerConfigId: "provider-a", baseUrl: "https://example.test/v1" }));
    expect(JSON.stringify(coreMocks.invoke.mock.calls)).not.toContain("api-key");
  });

  it("将未知或供应商原始错误体安全映射为固定文案", () => {
    const error = toAIProviderError({ code: "provider_error", message: "secret provider body", retryable: true });
    expect(error).toEqual({ code: "provider_error", message: "AI 服务拒绝了请求，请检查配置或请求格式", retryable: true });
    expect(error.message).not.toContain("secret provider body");
  });

  it("按 Channel 顺序显示流式片段并完成回答", async () => {
    coreMocks.invoke.mockResolvedValueOnce({ requestId: "request-1" });
    const deltas: string[] = [];
    const handle = await startAIChat({ requestId: "request-1", providerConfigId: "provider-a", baseUrl: "https://example.test/v1", modelId: "model-a", messages: [{ role: "user", content: "你好" }], dataExfiltrationConfirmed: true }, (delta) => deltas.push(delta));
    coreMocks.channel?.onmessage({ type: "delta", requestId: "request-1", content: "你" });
    coreMocks.channel?.onmessage({ type: "delta", requestId: "request-1", content: "好" });
    coreMocks.channel?.onmessage({ type: "complete", requestId: "request-1", content: "你好", streamed: true });
    await expect(handle.completion).resolves.toEqual({ requestId: "request-1", content: "你好", streamed: true, status: "complete" });
    expect(deltas).toEqual(["你", "好"]);
  });

  it("取消后忽略迟到片段并保留已收到内容", async () => {
    coreMocks.invoke.mockResolvedValueOnce({ requestId: "request-2" }).mockResolvedValueOnce(undefined);
    const handle = await startAIChat({ requestId: "request-2", providerConfigId: "provider-a", baseUrl: "https://example.test/v1", modelId: "model-a", messages: [{ role: "user", content: "继续" }], dataExfiltrationConfirmed: true });
    coreMocks.channel?.onmessage({ type: "delta", requestId: "request-2", content: "已" });
    await handle.cancel();
    coreMocks.channel?.onmessage({ type: "delta", requestId: "request-2", content: "迟到" });
    await expect(handle.completion).resolves.toEqual({ requestId: "request-2", content: "已", streamed: true, status: "stopped" });
    expect(coreMocks.invoke).toHaveBeenLastCalledWith("cancel_ai_chat", { requestId: "request-2" });
  });

  it("独立取消命令也会关闭前端流并丢弃迟到片段", async () => {
    coreMocks.invoke.mockResolvedValueOnce({ requestId: "request-3" }).mockResolvedValueOnce(undefined);
    const handle = await startAIChat({ requestId: "request-3", providerConfigId: "provider-a", baseUrl: "https://example.test/v1", modelId: "model-a", messages: [{ role: "user", content: "停止" }], dataExfiltrationConfirmed: true });
    coreMocks.channel?.onmessage({ type: "delta", requestId: "request-3", content: "已" });
    await cancelAIChat("request-3");
    coreMocks.channel?.onmessage({ type: "delta", requestId: "request-3", content: "迟到" });
    await expect(handle.completion).resolves.toEqual({ requestId: "request-3", content: "已", streamed: true, status: "stopped" });
  });
});

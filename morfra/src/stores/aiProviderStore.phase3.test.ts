import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIProviderConfig } from "../types/ai";

const persistenceMocks = vi.hoisted(() => ({
  loadAIProviderConfigs: vi.fn(),
  saveAIProviderConfigs: vi.fn(),
  loadAIPanelPreference: vi.fn(),
  saveAIPanelPreference: vi.fn(),
}));
const keychainMocks = vi.hoisted(() => ({
  setAIProviderSecret: vi.fn(),
  hasAIProviderSecret: vi.fn(),
  deleteAIProviderSecret: vi.fn(),
}));
const providerMocks = vi.hoisted(() => ({
  listAIModels: vi.fn(),
  testAIProvider: vi.fn(),
  startAIChat: vi.fn(),
  toAIProviderError: vi.fn(),
}));

vi.mock("../lib/ai/persistence", () => persistenceMocks);
vi.mock("../lib/ai/keychainClient", () => keychainMocks);
vi.mock("../lib/ai/providerClient", () => providerMocks);

const { useAIProviderStore } = await import("./aiProviderStore");

const CONFIG_A: AIProviderConfig = {
  id: "provider-a",
  name: "服务 A",
  baseUrl: "https://example.test/v1",
  defaultModelId: "model-a",
  cachedModelIds: [],
  capabilityStatus: "unknown",
  createdAt: "2026-08-08T08:00:00.000Z",
  updatedAt: "2026-08-08T08:00:00.000Z",
};

function preference(overrides: Record<string, unknown> = {}) {
  return {
    open: false,
    width: 360,
    defaultProviderConfigId: null,
    dataExfiltrationConfirmed: false,
    lastProviderConfigId: null,
    lastModelId: null,
    ...overrides,
  };
}

describe("aiProviderStore Phase 3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistenceMocks.loadAIProviderConfigs.mockResolvedValue({ value: [], issues: [] });
    persistenceMocks.loadAIPanelPreference.mockResolvedValue({ value: preference(), issues: [] });
    persistenceMocks.saveAIProviderConfigs.mockResolvedValue(undefined);
    persistenceMocks.saveAIPanelPreference.mockResolvedValue(undefined);
    keychainMocks.setAIProviderSecret.mockResolvedValue(undefined);
    keychainMocks.hasAIProviderSecret.mockResolvedValue(false);
    keychainMocks.deleteAIProviderSecret.mockResolvedValue(undefined);
    providerMocks.listAIModels.mockResolvedValue({ modelIds: ["model-a"], source: "remote" });
    providerMocks.testAIProvider.mockResolvedValue({ modelId: "model-a", chatAvailable: true, models: "unknown", streaming: "supported", structuredOutput: "unknown", toolCalls: "unknown" });
    providerMocks.toAIProviderError.mockImplementation((value: unknown) => {
      const code = typeof value === "object" && value !== null && "code" in value && typeof value.code === "string" ? value.code : "provider_error";
      return { code, message: code === "rate_limited" ? "AI 服务当前限流，请稍后重试" : "AI 服务请求失败", retryable: true };
    });
    useAIProviderStore.setState({
      configs: [],
      secretStatus: {},
      defaultProviderConfigId: null,
      dataExfiltrationConfirmed: false,
      lastProviderConfigId: null,
      lastModelId: null,
      loaded: true,
      busy: false,
      errorMessage: "",
    });
  });

  it("模型加载成功后缓存模型 ID，且只写非敏感配置", async () => {
    useAIProviderStore.setState({ configs: [CONFIG_A], dataExfiltrationConfirmed: true, secretStatus: { "provider-a": true } });
    const result = await useAIProviderStore.getState().loadModels("provider-a");
    expect(result.ok).toBe(true);
    expect(useAIProviderStore.getState().modelIds["provider-a"]).toEqual(["model-a"]);
    expect(useAIProviderStore.getState().configs[0]?.cachedModelIds).toEqual(["model-a"]);
    expect(JSON.stringify(persistenceMocks.saveAIProviderConfigs.mock.calls[0]?.[0])).not.toContain("unit-test-token");
  });

  it("模型列表失败时允许手填模型并单独完成连接测试", async () => {
    providerMocks.listAIModels.mockRejectedValueOnce({ code: "models_unavailable", message: "raw provider body", retryable: true });
    useAIProviderStore.setState({ configs: [CONFIG_A], dataExfiltrationConfirmed: true, secretStatus: { "provider-a": true } });
    const loadResult = await useAIProviderStore.getState().loadModels("provider-a");
    expect(loadResult).toMatchObject({ ok: false, code: "models_unavailable" });
    expect(useAIProviderStore.getState().modelLoadStatus["provider-a"]).toBe("failed");
    const manualResult = await useAIProviderStore.getState().setManualModel("provider-a", "manual-model");
    expect(manualResult.ok).toBe(true);
    const testResult = await useAIProviderStore.getState().testProvider("provider-a", "manual-model");
    expect(testResult.ok).toBe(true);
    expect(providerMocks.testAIProvider).toHaveBeenCalledWith(expect.objectContaining({ modelId: "manual-model" }));
  });

  it("测试连接成功后才保存配置元数据", async () => {
    providerMocks.testAIProvider.mockImplementationOnce(async () => {
      expect(persistenceMocks.saveAIProviderConfigs).not.toHaveBeenCalled();
      return { modelId: "model-a", chatAvailable: true, models: "unknown", streaming: "supported", structuredOutput: "unknown", toolCalls: "unknown" };
    });
    useAIProviderStore.setState({ dataExfiltrationConfirmed: true });

    const result = await useAIProviderStore.getState().saveProviderAfterConnectionTest({
      name: "服务 A",
      baseUrl: "https://example.test/v1",
      defaultModelId: "model-a",
      secret: "transient-key",
    });

    expect(result.ok).toBe(true);
    expect(persistenceMocks.saveAIProviderConfigs).toHaveBeenCalledOnce();
    expect(useAIProviderStore.getState().configs[0]).toMatchObject({ name: "服务 A", defaultModelId: "model-a" });
    expect(JSON.stringify(useAIProviderStore.getState().configs)).not.toContain("transient-key");
    expect(keychainMocks.deleteAIProviderSecret).toHaveBeenCalledOnce();
  });

  it("临时密钥清理失败时回滚元数据且不写入正式密钥", async () => {
    keychainMocks.deleteAIProviderSecret.mockRejectedValueOnce(new Error("keychain unavailable"));
    useAIProviderStore.setState({ dataExfiltrationConfirmed: true });

    const result = await useAIProviderStore.getState().saveProviderAfterConnectionTest({
      name: "服务 A",
      baseUrl: "https://example.test/v1",
      defaultModelId: "model-a",
      secret: "transient-key",
    });

    expect(result.ok).toBe(false);
    expect(useAIProviderStore.getState().configs).toEqual([]);
    expect(keychainMocks.setAIProviderSecret).toHaveBeenCalledOnce();
    expect(keychainMocks.setAIProviderSecret.mock.calls[0]?.[0]).toMatch(/-probe-/u);
    expect(persistenceMocks.saveAIProviderConfigs).toHaveBeenLastCalledWith([]);
  });

  it("能力探测发现不支持流式时降级为 limited，不推断结构化能力", async () => {
    providerMocks.testAIProvider.mockResolvedValueOnce({ modelId: "model-a", chatAvailable: true, models: "unknown", streaming: "unsupported", structuredOutput: "unknown", toolCalls: "unknown" });
    useAIProviderStore.setState({ configs: [CONFIG_A], dataExfiltrationConfirmed: true, secretStatus: { "provider-a": true } });
    const result = await useAIProviderStore.getState().testProvider("provider-a");
    expect(result.ok).toBe(true);
    expect(useAIProviderStore.getState().configs[0]?.capabilityStatus).toBe("limited");
    expect(useAIProviderStore.getState().capabilities["provider-a"]?.structuredOutput).toBe("unknown");
  });

  it("模型列表网络失败时保持模型能力 unknown", async () => {
    providerMocks.listAIModels.mockRejectedValueOnce({ code: "network_unavailable", message: "raw network error", retryable: true });
    useAIProviderStore.setState({ configs: [CONFIG_A], dataExfiltrationConfirmed: true, secretStatus: { "provider-a": true } });

    const result = await useAIProviderStore.getState().loadModels("provider-a");

    expect(result).toMatchObject({ ok: false, code: "network_unavailable" });
    expect(useAIProviderStore.getState().capabilities["provider-a"]?.models).toBe("unknown");
  });

  it("未确认首次外传时禁止模型加载、连接测试和聊天", async () => {
    useAIProviderStore.setState({ configs: [CONFIG_A], secretStatus: { "provider-a": true }, dataExfiltrationConfirmed: false });
    expect(await useAIProviderStore.getState().loadModels("provider-a")).toMatchObject({ ok: false, code: "data_exfiltration_not_confirmed" });
    expect(await useAIProviderStore.getState().testProvider("provider-a")).toMatchObject({ ok: false, code: "data_exfiltration_not_confirmed" });
    expect(await useAIProviderStore.getState().startChat({ providerConfigId: "provider-a", messages: [{ role: "user", content: "你好" }] })).toMatchObject({ ok: false, code: "data_exfiltration_not_confirmed" });
    expect(providerMocks.listAIModels).not.toHaveBeenCalled();
    expect(providerMocks.testAIProvider).not.toHaveBeenCalled();
    expect(providerMocks.startAIChat).not.toHaveBeenCalled();
  });

  it("流式片段进入状态并可取消，取消后保留已生成内容", async () => {
    let finish!: (value: { requestId: string; content: string; streamed: boolean; status: "stopped" }) => void;
    const completion = new Promise<{ requestId: string; content: string; streamed: boolean; status: "stopped" }>((resolve) => { finish = resolve; });
    const handle = { requestId: "request-1", completion, cancel: vi.fn(async () => finish({ requestId: "request-1", content: "已生成", streamed: true, status: "stopped" })) };
    providerMocks.startAIChat.mockImplementationOnce(async (_request: unknown, onDelta?: (content: string) => void) => { onDelta?.("已"); return handle; });
    useAIProviderStore.setState({ configs: [CONFIG_A], dataExfiltrationConfirmed: true, secretStatus: { "provider-a": true } });
    const run = useAIProviderStore.getState().startChat({ providerConfigId: "provider-a", messages: [{ role: "user", content: "继续" }] });
    await Promise.resolve();
    await Promise.resolve();
    expect(useAIProviderStore.getState().chatStatus).toBe("streaming");
    expect(useAIProviderStore.getState().chatContent).toBe("已");
    await useAIProviderStore.getState().cancelChat();
    expect((await run).ok).toBe(true);
    expect(useAIProviderStore.getState().chatStatus).toBe("stopped");
    expect(useAIProviderStore.getState().chatContent).toBe("已生成");
    expect(handle.cancel).toHaveBeenCalledOnce();
  });

  it("启动命令尚未返回句柄时也会排队取消，并丢弃之后的片段", async () => {
    let resolveStart!: (handle: { requestId: string; completion: Promise<{ requestId: string; content: string; streamed: boolean; status: "stopped" }>; cancel: () => Promise<void> }) => void;
    let finish!: (value: { requestId: string; content: string; streamed: boolean; status: "stopped" }) => void;
    const completion = new Promise<{ requestId: string; content: string; streamed: boolean; status: "stopped" }>((resolve) => { finish = resolve; });
    const handle = { requestId: "request-race", completion, cancel: vi.fn(async () => finish({ requestId: "request-race", content: "", streamed: true, status: "stopped" })) };
    providerMocks.startAIChat.mockImplementationOnce(() => new Promise((resolve) => { resolveStart = resolve; }));
    useAIProviderStore.setState({ configs: [CONFIG_A], dataExfiltrationConfirmed: true, secretStatus: { "provider-a": true } });
    const run = useAIProviderStore.getState().startChat({ providerConfigId: "provider-a", messages: [{ role: "user", content: "停止" }] });
    await Promise.resolve();
    expect((await useAIProviderStore.getState().cancelChat()).ok).toBe(true);
    expect(useAIProviderStore.getState().chatCancelRequested).toBe(true);
    resolveStart(handle);
    expect((await run).ok).toBe(true);
    expect(handle.cancel).toHaveBeenCalledOnce();
    expect(useAIProviderStore.getState().chatStatus).toBe("stopped");
  });});

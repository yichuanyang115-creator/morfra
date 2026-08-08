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
const CONFIG_B: AIProviderConfig = { ...CONFIG_A, id: "provider-b", name: "服务 B", defaultModelId: "model-b" };

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

describe("aiProviderStore", () => {
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

  it("加载重启后的非敏感配置，只保留布尔密钥状态", async () => {
    persistenceMocks.loadAIProviderConfigs.mockResolvedValue({ value: [CONFIG_A], issues: [] });
    persistenceMocks.loadAIPanelPreference.mockResolvedValue({ value: preference({ defaultProviderConfigId: "provider-a", lastProviderConfigId: "provider-a", lastModelId: "model-a" }), issues: [] });
    keychainMocks.hasAIProviderSecret.mockResolvedValue(true);

    await useAIProviderStore.getState().load();

    expect(useAIProviderStore.getState().configs).toEqual([CONFIG_A]);
    expect(useAIProviderStore.getState().secretStatus).toEqual({ "provider-a": true });
    expect(useAIProviderStore.getState().lastProviderConfigId).toBe("provider-a");
    expect(useAIProviderStore.getState().lastModelId).toBe("model-a");
  });

  it("Keychain 状态读取失败时显示可恢复错误而不是伪装成未配置", async () => {
    persistenceMocks.loadAIProviderConfigs.mockResolvedValue({ value: [CONFIG_A], issues: [] });
    keychainMocks.hasAIProviderSecret.mockRejectedValueOnce(new Error("keychain unavailable"));

    await useAIProviderStore.getState().load();

    expect(useAIProviderStore.getState().secretStatus).toEqual({ "provider-a": false });
    expect(useAIProviderStore.getState().errorMessage).toBe("系统密钥存储不可用，请检查 macOS Keychain 后重试");
  });

  it("新建配置只把一次性密钥交给 Keychain，不写入非敏感配置", async () => {
    const transientInput = ["one", "time", "input"].join("-");
    const result = await useAIProviderStore.getState().saveProvider({
      name: "服务 A",
      baseUrl: "https://example.test/v1/",
      defaultModelId: "model-a",
      secret: transientInput,
    });

    expect(result.ok).toBe(true);
    expect(keychainMocks.setAIProviderSecret).toHaveBeenCalledWith(expect.any(String), transientInput);
    const savedConfigs = persistenceMocks.saveAIProviderConfigs.mock.calls[0][0] as AIProviderConfig[];
    expect(savedConfigs[0]).toMatchObject({ name: "服务 A", baseUrl: "https://example.test/v1" });
    expect(JSON.stringify(savedConfigs)).not.toContain(transientInput);
    expect(JSON.stringify(useAIProviderStore.getState())).not.toContain(transientInput);
  });

  it("编辑时留空密钥会保留现有状态，且可设置全局默认", async () => {
    useAIProviderStore.setState({ configs: [CONFIG_A, CONFIG_B], secretStatus: { "provider-a": true, "provider-b": true }, defaultProviderConfigId: "provider-a" });

    const editResult = await useAIProviderStore.getState().saveProvider({ ...CONFIG_B, secret: "" });
    expect(editResult.ok).toBe(true);
    expect(keychainMocks.setAIProviderSecret).not.toHaveBeenCalled();

    const defaultResult = await useAIProviderStore.getState().setDefaultProvider("provider-b");
    expect(defaultResult.ok).toBe(true);
    expect(useAIProviderStore.getState().defaultProviderConfigId).toBe("provider-b");
    expect(persistenceMocks.saveAIPanelPreference).toHaveBeenCalledWith(expect.objectContaining({ defaultProviderConfigId: "provider-b" }));
  });

  it("编辑非默认的最近服务时不覆盖最近模型偏好", async () => {
    useAIProviderStore.setState({
      configs: [CONFIG_A, CONFIG_B],
      secretStatus: { "provider-a": true, "provider-b": true },
      defaultProviderConfigId: "provider-a",
      lastProviderConfigId: "provider-b",
      lastModelId: "model-b-last",
    });

    const result = await useAIProviderStore.getState().saveProvider({ ...CONFIG_B, defaultModelId: "model-b-edited", secret: "" });

    expect(result.ok).toBe(true);
    expect(useAIProviderStore.getState().lastProviderConfigId).toBe("provider-b");
    expect(useAIProviderStore.getState().lastModelId).toBe("model-b-last");
    expect(persistenceMocks.saveAIPanelPreference).toHaveBeenLastCalledWith(expect.objectContaining({ lastProviderConfigId: "provider-b", lastModelId: "model-b-last" }));
  });

  it("保存首次外传确认状态", async () => {
    const result = await useAIProviderStore.getState().confirmDataExfiltration();
    expect(result.ok).toBe(true);
    expect(useAIProviderStore.getState().dataExfiltrationConfirmed).toBe(true);
    expect(persistenceMocks.saveAIPanelPreference).toHaveBeenCalledWith(expect.objectContaining({ dataExfiltrationConfirmed: true }));
  });

  it("删除配置同步删除密钥和非敏感配置，不触碰会话存储", async () => {
    useAIProviderStore.setState({ configs: [CONFIG_A, CONFIG_B], secretStatus: { "provider-a": true, "provider-b": true }, defaultProviderConfigId: "provider-a" });

    const result = await useAIProviderStore.getState().deleteProvider("provider-a");

    expect(result.ok).toBe(true);
    expect(keychainMocks.deleteAIProviderSecret).toHaveBeenCalledWith("provider-a");
    expect(useAIProviderStore.getState().configs).toEqual([CONFIG_B]);
    expect(useAIProviderStore.getState().defaultProviderConfigId).toBe("provider-b");
    expect(persistenceMocks.saveAIProviderConfigs).toHaveBeenLastCalledWith([CONFIG_B]);
  });

  it("Keychain 删除失败时回滚已写入的非敏感配置", async () => {
    useAIProviderStore.setState({ configs: [CONFIG_A, CONFIG_B], secretStatus: { "provider-a": true, "provider-b": true }, defaultProviderConfigId: "provider-a", lastProviderConfigId: "provider-a", lastModelId: "model-a" });
    keychainMocks.deleteAIProviderSecret.mockRejectedValueOnce(new Error("keychain unavailable"));

    const result = await useAIProviderStore.getState().deleteProvider("provider-a");

    expect(result.ok).toBe(false);
    expect(useAIProviderStore.getState().configs).toEqual([CONFIG_A, CONFIG_B]);
    expect(useAIProviderStore.getState().secretStatus).toEqual({ "provider-a": true, "provider-b": true });
    expect(useAIProviderStore.getState().lastProviderConfigId).toBe("provider-a");
    expect(useAIProviderStore.getState().lastModelId).toBe("model-a");
    expect(persistenceMocks.saveAIProviderConfigs).toHaveBeenLastCalledWith([CONFIG_A, CONFIG_B]);
    expect(persistenceMocks.saveAIPanelPreference).toHaveBeenLastCalledWith(expect.objectContaining({ lastProviderConfigId: "provider-a", lastModelId: "model-a" }));
    expect(keychainMocks.deleteAIProviderSecret).toHaveBeenCalledWith("provider-a");
  });

  it("Keychain 保存失败时回滚非敏感配置且不把底层错误展示给用户", async () => {
    const transientInput = ["one", "time", "input"].join("-");
    keychainMocks.setAIProviderSecret.mockRejectedValueOnce(new Error(`secret ${transientInput}`));

    const result = await useAIProviderStore.getState().saveProvider({
      name: "服务 A",
      baseUrl: "https://example.test/v1",
      defaultModelId: "model-a",
      secret: transientInput,
    });

    expect(result).toEqual({ ok: false, message: "AI 服务保存失败，请重试" });
    expect(useAIProviderStore.getState().configs).toEqual([]);
    expect(useAIProviderStore.getState().errorMessage).not.toContain(transientInput);
  });

  it("默认配置保存失败时不改变内存状态", async () => {
    useAIProviderStore.setState({ configs: [CONFIG_A, CONFIG_B], defaultProviderConfigId: "provider-a" });
    persistenceMocks.saveAIPanelPreference.mockRejectedValueOnce(new Error("write failed"));

    const result = await useAIProviderStore.getState().setDefaultProvider("provider-b");

    expect(result.ok).toBe(false);
    expect(useAIProviderStore.getState().defaultProviderConfigId).toBe("provider-a");
    expect(useAIProviderStore.getState().errorMessage).toBe("默认 AI 服务保存失败，请重试");
  });

  it("拒绝空名称、非 HTTPS 地址和空模型 ID", async () => {
    const result = await useAIProviderStore.getState().saveProvider({ name: "", baseUrl: "http://example.test", defaultModelId: "", secret: "value" });
    expect(result).toMatchObject({ ok: false, issues: { name: expect.any(String), baseUrl: expect.any(String), defaultModelId: expect.any(String) } });
    expect(persistenceMocks.saveAIProviderConfigs).not.toHaveBeenCalled();
    expect(keychainMocks.setAIProviderSecret).not.toHaveBeenCalled();
  });

});

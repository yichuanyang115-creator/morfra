import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIProviderConfig } from "../../types/ai";

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

vi.mock("../../lib/ai/persistence", () => persistenceMocks);
vi.mock("../../lib/ai/keychainClient", () => keychainMocks);

const { useAIProviderStore } = await import("../../stores/aiProviderStore");
const { AIServiceSettings } = await import("./AIServiceSettings");
const { AIProviderEditor } = await import("./AIProviderEditor");

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

describe("AIServiceSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistenceMocks.saveAIProviderConfigs.mockResolvedValue(undefined);
    persistenceMocks.saveAIPanelPreference.mockResolvedValue(undefined);
    keychainMocks.setAIProviderSecret.mockResolvedValue(undefined);
    keychainMocks.deleteAIProviderSecret.mockResolvedValue(undefined);
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

  afterEach(() => cleanup());

  it("新建、取消并清理一次性密钥输入", async () => {
    const user = userEvent.setup();
    render(<AIServiceSettings />);
    await user.click(screen.getByRole("button", { name: "新建 AI 服务" }));
    await user.type(screen.getByLabelText("配置名称"), "新服务");
    await user.type(screen.getByLabelText("HTTPS Base URL"), "https://new.example/v1");
    await user.type(screen.getByLabelText("默认模型 ID"), "new-model");
    await user.type(screen.getByLabelText(/API Key/), ["one", "time", "input"].join("-"));
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("heading", { name: "新建 AI 服务" })).not.toBeInTheDocument();
    expect(useAIProviderStore.getState().configs).toEqual([]);
  });

  it("保存成功后立即清理编辑器中的密钥输入", async () => {
    const user = userEvent.setup();
    const transientSecret = ["one", "time", "input"].join("-");
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    render(
      <AIProviderEditor
        hasSecret={false}
        onSave={onSave}
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.type(screen.getByLabelText("配置名称"), "新服务");
    await user.type(screen.getByLabelText("HTTPS Base URL"), "https://new.example");
    await user.type(screen.getByLabelText("默认模型 ID"), "new-model");
    await user.type(screen.getByLabelText(/API Key/), transientSecret);
    await user.click(screen.getByRole("button", { name: "保存服务" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ secret: transientSecret }));
    expect(screen.getByLabelText(/API Key/)).toHaveValue("");
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("保存失败时保留编辑内容并显示安全错误", async () => {
    const user = userEvent.setup();
    const transientSecret = ["one", "time", "input"].join("-");
    render(
      <AIProviderEditor
        hasSecret={false}
        onSave={vi.fn().mockResolvedValue({ ok: false, message: "AI 服务保存失败，请重试" })}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("配置名称"), "新服务");
    await user.type(screen.getByLabelText("HTTPS Base URL"), "https://new.example");
    await user.type(screen.getByLabelText("默认模型 ID"), "new-model");
    await user.type(screen.getByLabelText(/API Key/), transientSecret);
    await user.click(screen.getByRole("button", { name: "保存服务" }));

    expect(screen.getByRole("alert")).toHaveTextContent("AI 服务保存失败，请重试");
    expect(screen.getByLabelText(/API Key/)).toHaveValue(transientSecret);
  });

  it("校验输入并保存新配置，页面只显示密钥状态", async () => {
    const user = userEvent.setup();
    render(<AIServiceSettings />);
    await user.click(screen.getByRole("button", { name: "新建 AI 服务" }));
    await user.type(screen.getByLabelText("配置名称"), "新服务");
    await user.type(screen.getByLabelText("HTTPS Base URL"), "http://new.example");
    await user.type(screen.getByLabelText("默认模型 ID"), "new-model");
    await user.type(screen.getByLabelText(/API Key/), ["one", "time", "input"].join("-"));
    await user.click(screen.getByRole("button", { name: "保存服务" }));
    expect(screen.getByText("Base URL 必须使用 HTTPS")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/HTTPS Base URL/));
    await user.type(screen.getByLabelText(/HTTPS Base URL/), "https://new.example");
    await user.click(screen.getByRole("button", { name: "保存服务" }));
    expect(await screen.findByText("新服务")).toBeInTheDocument();
    expect(screen.getByText("密钥已配置")).toBeInTheDocument();
    expect(screen.queryByText(["one", "time", "input"].join("-"))).not.toBeInTheDocument();
  });

  it("编辑已有配置、保留空密钥并切换全局默认", async () => {
    const user = userEvent.setup();
    useAIProviderStore.setState({ configs: [CONFIG_A, CONFIG_B], secretStatus: { "provider-a": true, "provider-b": true }, defaultProviderConfigId: "provider-a" });
    render(<AIServiceSettings />);
    await user.click(screen.getAllByRole("button", { name: "编辑" })[0]);
    expect(screen.getByDisplayValue("服务 A")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("配置名称"));
    await user.type(screen.getByLabelText("配置名称"), "服务 A（已改）");
    await user.click(screen.getByRole("button", { name: "保存服务" }));
    expect(await screen.findByText("服务 A（已改）")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "设为默认" }));
    expect(useAIProviderStore.getState().defaultProviderConfigId).toBe("provider-b");
  });

  it("首次外传说明需要明确确认", async () => {
    const user = userEvent.setup();
    render(<AIServiceSettings />);
    expect(screen.getByRole("heading", { name: "首次使用说明" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "我已了解，确认继续" }));
    expect(useAIProviderStore.getState().dataExfiltrationConfirmed).toBe(true);
    expect(screen.queryByRole("heading", { name: "首次使用说明" })).not.toBeInTheDocument();
  });

  it("删除需要二次确认，确认后只删服务和 Keychain 项", async () => {
    const user = userEvent.setup();
    useAIProviderStore.setState({ configs: [CONFIG_A], secretStatus: { "provider-a": true }, defaultProviderConfigId: "provider-a", dataExfiltrationConfirmed: true });
    render(<AIServiceSettings />);
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(screen.getByText(/不会删除任何 AI 会话数据/)).toBeInTheDocument();
    const deleteButtons = screen.getAllByRole("button", { name: "删除" });
    const dialogDelete = deleteButtons[deleteButtons.length - 1];
    await user.click(dialogDelete!);
    expect(useAIProviderStore.getState().configs).toEqual([]);
    expect(keychainMocks.deleteAIProviderSecret).toHaveBeenCalledWith("provider-a");
  });
});

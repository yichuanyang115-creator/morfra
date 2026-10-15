import { describe, expect, it } from "vitest";
import type { AIProviderConfig } from "../../types/ai";
import { parseProviderDocument } from "./persistenceValidation";

const PROVIDER: AIProviderConfig = {
  id: "provider-1",
  name: "兼容服务",
  baseUrl: "https://example.com/v1",
  defaultModelId: "model-1",
  cachedModelIds: [],
  capabilityStatus: "unknown",
  createdAt: "2026-08-08T08:00:00.000Z",
  updatedAt: "2026-08-08T08:00:00.000Z",
};

describe("AI 配置加载边界", () => {
  it.each([
    ["HTTP Base URL", { baseUrl: "http://example.com/v1" }],
    ["空模型 ID", { defaultModelId: "   " }],
    ["包含空白的模型 ID", { defaultModelId: "model one" }],
    ["过长的模型 ID", { defaultModelId: "m".repeat(161) }],
    ["空配置名称", { name: "   " }],
    ["过长的配置名称", { name: "n".repeat(81) }],
  ])("拒绝被篡改的%s", (_label, override) => {
    const result = parseProviderDocument({ version: 1, configs: [{ ...PROVIDER, ...override }] });
    expect(result).toBeNull();
  });

  it("接受合法的 HTTPS 配置", () => {
    expect(parseProviderDocument({ version: 1, configs: [PROVIDER] })).toMatchObject({ configs: [PROVIDER] });
  });
});

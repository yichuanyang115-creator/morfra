export interface AIProviderDraft {
  id?: string;
  name: string;
  baseUrl: string;
  defaultModelId: string;
  secret: string;
}

export interface AIProviderValidationIssues {
  name?: string;
  baseUrl?: string;
  defaultModelId?: string;
  secret?: string;
}

export interface NormalizedAIProviderDraft extends Omit<AIProviderDraft, "id" | "secret"> {
  id?: string;
  secret: string;
}

export function normalizeAIProviderBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/u, "");
}

export function getAIProviderBaseUrlIssue(baseUrl: string): string | undefined {
  const normalizedBaseUrl = normalizeAIProviderBaseUrl(baseUrl);
  try {
    const parsed = new URL(normalizedBaseUrl);
    if (parsed.protocol !== "https:") return "Base URL 必须使用 HTTPS";
    if (!parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return "请输入不含账号、密码、查询参数或片段的 HTTPS Base URL";
    }
  } catch {
    return "请输入有效的 HTTPS Base URL";
  }
  return undefined;
}

export function getAIProviderNameIssue(name: string): string | undefined {
  const normalizedName = name.trim();
  if (!normalizedName) return "请输入配置名称";
  if (normalizedName.length > 80) return "配置名称不能超过 80 个字符";
  return undefined;
}

export function getAIProviderModelIssue(modelId: string): string | undefined {
  const normalizedModelId = modelId.trim();
  if (!normalizedModelId) return "请输入默认模型 ID";
  if (normalizedModelId.length > 160 || /\s/u.test(normalizedModelId)) return "模型 ID 不能包含空白或超过 160 个字符";
  return undefined;
}

export function validateAIProviderDraft(
  draft: AIProviderDraft,
  hasExistingSecret: boolean,
  options: { requireModel?: boolean } = {},
): { valid: true; value: NormalizedAIProviderDraft } | { valid: false; issues: AIProviderValidationIssues } {
  const name = draft.name.trim();
  const baseUrl = normalizeAIProviderBaseUrl(draft.baseUrl);
  const defaultModelId = draft.defaultModelId.trim();
  const secret = draft.secret;
  const issues: AIProviderValidationIssues = {};

  const nameIssue = getAIProviderNameIssue(name);
  if (nameIssue) issues.name = nameIssue;

  const baseUrlIssue = getAIProviderBaseUrlIssue(baseUrl);
  if (baseUrlIssue) issues.baseUrl = baseUrlIssue;

  const modelIssue = getAIProviderModelIssue(defaultModelId);
  if (options.requireModel !== false && modelIssue) issues.defaultModelId = modelIssue;

  if (!draft.id && !secret.trim()) issues.secret = "新建服务必须填写 API Key";
  else if (secret.includes("\n") || secret.includes("\r")) issues.secret = "API Key 不能包含换行";
  else if (!secret.trim() && !hasExistingSecret) issues.secret = "请先配置 API Key";

  if (Object.keys(issues).length > 0) return { valid: false, issues };
  return { valid: true, value: { id: draft.id, name, baseUrl, defaultModelId, secret } };
}

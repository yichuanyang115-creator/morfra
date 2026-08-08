import { useEffect, useState, type FormEvent } from "react";
import type { AIProviderConfig } from "../../types/ai";
import { validateAIProviderDraft } from "../../lib/ai/aiProviderValidation";
import type { AIProviderActionResult } from "../../stores/aiProviderStore";

type AIProviderEditorDraft = { id?: string; name: string; baseUrl: string; defaultModelId: string; secret: string };
const EMPTY_MODEL_IDS: string[] = [];

interface AIProviderEditorProps {
  config?: AIProviderConfig;
  hasSecret: boolean;
  modelIds?: string[];
  onSave: (draft: AIProviderEditorDraft) => Promise<AIProviderActionResult>;
  onTestAndSave?: (draft: AIProviderEditorDraft) => Promise<AIProviderActionResult>;
  onLoadModels?: (draft: AIProviderEditorDraft) => Promise<AIProviderActionResult>;
  onCancel: () => void;
  onSaved: () => void;
}

export function AIProviderEditor({ config, hasSecret, modelIds = EMPTY_MODEL_IDS, onSave, onTestAndSave, onLoadModels, onCancel, onSaved }: AIProviderEditorProps) {
  const [name, setName] = useState(config?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? "");
  const [defaultModelId, setDefaultModelId] = useState(config?.defaultModelId ?? "");
  const [secret, setSecret] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [availableModelIds, setAvailableModelIds] = useState<string[]>(modelIds.length > 0 ? modelIds : config?.cachedModelIds ?? []);

  useEffect(() => {
    setName(config?.name ?? "");
    setBaseUrl(config?.baseUrl ?? "");
    setDefaultModelId(config?.defaultModelId ?? "");
    setSecret("");
    setIssues({});
    setSubmitError("");
    setAvailableModelIds(modelIds.length > 0 ? modelIds : config?.cachedModelIds ?? []);
  }, [config, modelIds]);

  const handleLoadModels = async () => {
    if (!onLoadModels) return;
    setLoadingModels(true);
    setIssues({});
    setSubmitError("");
    const result = await onLoadModels({ id: config?.id, name, baseUrl, defaultModelId, secret });
    setLoadingModels(false);
    if (!result.ok) {
      setIssues((result.issues ?? {}) as Record<string, string>);
      setSubmitError(result.message);
      return;
    }
    const nextModelIds = result.modelIds ?? [];
    setAvailableModelIds(nextModelIds);
    if (!defaultModelId.trim() && nextModelIds[0]) setDefaultModelId(nextModelIds[0]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = { id: config?.id, name, baseUrl, defaultModelId, secret };
    const validation = validateAIProviderDraft(draft, hasSecret);
    if (!validation.valid) {
      setIssues(validation.issues as Record<string, string>);
      return;
    }
    setSaving(true);
    setSubmitError("");
    const result = await (onTestAndSave ? onTestAndSave(draft) : onSave(draft));
    setSaving(false);
    if (!result.ok) {
      setIssues((result.issues ?? {}) as Record<string, string>);
      setSubmitError(result.message);
      return;
    }
    setSecret("");
    onSaved();
  };

  const fieldClass = "mt-1 w-full rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2.5 py-1.75 text-[12.5px] text-(--module-scope-text-primary) outline-none focus:border-(--module-scope-action-base)";
  const error = (field: string) => issues[field] ? <p className="m-0 mt-1 text-[11.5px] text-(--module-scope-feedback-danger)">{issues[field]}</p> : null;

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="max-w-xl rounded-(--r-md) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-4">
      <div className="mb-4">
        <h2 className="m-0 text-[14px] font-[590] text-(--module-scope-text-primary)">{config ? "编辑 AI 服务" : "新建 AI 服务"}</h2>
        <p className="m-0 mt-1 text-[12px] text-(--module-scope-text-secondary)">只保存服务元数据；API Key 仅写入 macOS Keychain。模型列表不可用时，可直接填写模型 ID 并单独测试。</p>
      </div>
      {submitError && <p role="alert" className="mb-3 rounded-(--r-sm) bg-(--module-scope-feedback-danger-soft) p-2 text-[12px] text-(--module-scope-feedback-danger)">{submitError}</p>}
      <label className="block text-[12px] text-(--module-scope-text-secondary)" htmlFor="ai-provider-name">
        配置名称
        <input id="ai-provider-name" value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} autoComplete="off" />
        {error("name")}
      </label>
      <label className="mt-3 block text-[12px] text-(--module-scope-text-secondary)" htmlFor="ai-provider-base-url">
        HTTPS Base URL
        <input id="ai-provider-base-url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className={fieldClass} placeholder="https://api.example.com/v1" autoComplete="url" />
        {error("baseUrl")}
      </label>
      <label className="mt-3 block text-[12px] text-(--module-scope-text-secondary)" htmlFor="ai-provider-model">
        默认模型 ID
        <input id="ai-provider-model" value={defaultModelId} onChange={(event) => setDefaultModelId(event.target.value)} className={fieldClass} autoComplete="off" />
        {error("defaultModelId")}
      </label>
      {onLoadModels && <div className="mt-2 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="block text-[12px] text-(--module-scope-text-secondary)" htmlFor="ai-provider-model-select">可选模型</label>
          <select id="ai-provider-model-select" value={availableModelIds.includes(defaultModelId) ? defaultModelId : ""} onChange={(event) => { if (event.target.value) setDefaultModelId(event.target.value); }} disabled={loadingModels || availableModelIds.length === 0} className={fieldClass}>
            <option value="">{availableModelIds.length > 0 ? "选择模型或继续手填" : "尚未加载模型列表"}</option>
            {availableModelIds.map((modelId) => <option key={modelId} value={modelId}>{modelId}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => void handleLoadModels()} disabled={loadingModels || saving} className="rounded-(--r-sm) border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) px-3 py-1.75 text-[12px] text-(--module-scope-text-primary) disabled:cursor-not-allowed disabled:opacity-50">{loadingModels ? "加载中…" : "加载模型"}</button>
      </div>}
      <label className="mt-3 block text-[12px] text-(--module-scope-text-secondary)" htmlFor="ai-provider-secret">
        API Key
        <input id="ai-provider-secret" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} className={fieldClass} autoComplete="new-password" placeholder={hasSecret ? "留空以保留现有密钥" : "仅在本次保存时使用"} />
        <span className="mt-1 block text-[11.5px] text-(--module-scope-text-tertiary)">{hasSecret ? "当前状态：密钥已配置；留空不会覆盖。" : "当前状态：未配置密钥。"}</span>
        {error("secret")}
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-(--r-sm) border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) px-3 py-1.5 text-[12.5px] text-(--module-scope-text-primary)">取消</button>
        <button type="submit" disabled={saving} className="rounded-(--r-sm) border-none bg-(--module-scope-action-strong) px-3 py-1.5 text-[12.5px] text-(--module-scope-background-surface) disabled:cursor-not-allowed disabled:opacity-50">{saving ? "测试并保存中…" : onTestAndSave ? "测试连接并保存" : "保存服务"}</button>
      </div>
    </form>
  );
}

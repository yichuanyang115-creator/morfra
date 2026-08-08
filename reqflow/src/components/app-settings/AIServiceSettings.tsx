import { useEffect, useState } from "react";
import { useAIProviderStore } from "../../stores/aiProviderStore";
import type { AIProviderConfig } from "../../types/ai";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { AIProviderEditor } from "./AIProviderEditor";

export function AIServiceSettings() {
  const configs = useAIProviderStore((state) => state.configs);
  const secretStatus = useAIProviderStore((state) => state.secretStatus);
  const defaultProviderConfigId = useAIProviderStore((state) => state.defaultProviderConfigId);
  const dataExfiltrationConfirmed = useAIProviderStore((state) => state.dataExfiltrationConfirmed);
  const loaded = useAIProviderStore((state) => state.loaded);
  const busy = useAIProviderStore((state) => state.busy);
  const errorMessage = useAIProviderStore((state) => state.errorMessage);
  const load = useAIProviderStore((state) => state.load);
  const saveProvider = useAIProviderStore((state) => state.saveProvider);
  const setDefaultProvider = useAIProviderStore((state) => state.setDefaultProvider);
  const confirmDataExfiltration = useAIProviderStore((state) => state.confirmDataExfiltration);
  const deleteProvider = useAIProviderStore((state) => state.deleteProvider);
  const clearError = useAIProviderStore((state) => state.clearError);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AIProviderConfig | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [load, loaded]);

  if (!loaded) return <section className="max-w-2xl p-6 text-[13px] text-(--module-scope-text-secondary)">加载 AI 服务…</section>;

  const editingConfig = editingId && editingId !== "new" ? configs.find((config) => config.id === editingId) : undefined;
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteProvider(deleteTarget.id);
    if (result.ok) setDeleteTarget(null);
  };

  return (
    <section className="min-w-0 flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="m-0 text-[16px] font-[590] text-(--module-scope-text-primary)">AI 服务</h1>
            <p className="m-0 mt-1 text-[12.5px] text-(--module-scope-text-secondary)">管理兼容服务配置。当前 Phase 不会调用模型接口。</p>
          </div>
          {!editingId && <button type="button" onClick={() => { clearError(); setEditingId("new"); }} className="rounded-(--r-sm) border-none bg-(--module-scope-action-strong) px-3 py-1.75 text-[12.5px] text-(--module-scope-background-surface)">新建 AI 服务</button>}
        </div>

        {!dataExfiltrationConfirmed && (
          <section aria-labelledby="ai-data-notice" className="mb-4 rounded-(--r-md) border border-(--module-scope-feedback-warning) bg-(--module-scope-feedback-warning-soft) p-4">
            <h2 id="ai-data-notice" className="m-0 text-[13px] font-[590] text-(--module-scope-text-primary)">首次使用说明</h2>
            <p className="m-0 mt-1.5 text-[12px] leading-5 text-(--module-scope-text-secondary)">当你主动发送问题或执行连接测试时，当前表格中必要的数据可能发送到你选择的第三方 AI 服务。应用不会后台上传表格数据，API Key 只保存在 macOS Keychain。</p>
            <button type="button" onClick={() => void confirmDataExfiltration()} disabled={busy} className="mt-3 rounded-(--r-sm) border-none bg-(--module-scope-action-strong) px-3 py-1.5 text-[12px] text-(--module-scope-background-surface)">我已了解，确认继续</button>
          </section>
        )}

        {errorMessage && <p role="alert" className="mb-4 rounded-(--r-sm) bg-(--module-scope-feedback-danger-soft) p-2.5 text-[12px] text-(--module-scope-feedback-danger)">{errorMessage}</p>}

        {editingId ? (
          <AIProviderEditor
            config={editingConfig}
            hasSecret={editingConfig ? secretStatus[editingConfig.id] === true : false}
            onSave={saveProvider}
            onCancel={() => setEditingId(null)}
            onSaved={() => setEditingId(null)}
          />
        ) : (
          <div className="grid gap-3">
            {configs.length === 0 && <div className="rounded-(--r-md) border border-dashed border-(--module-scope-border-subtle) p-6 text-[12.5px] text-(--module-scope-text-secondary)">暂无 AI 服务配置，先新建一组服务。</div>}
            {configs.map((config) => (
              <article key={config.id} className="rounded-(--r-md) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="m-0 truncate text-[13.5px] font-[590] text-(--module-scope-text-primary)">{config.name}</h2>
                      {config.id === defaultProviderConfigId && <span className="rounded-(--r-full) bg-(--module-scope-context-soft) px-2 py-0.5 text-[11px] text-(--module-scope-context-strong)">全局默认</span>}
                    </div>
                    <p className="m-0 mt-1 truncate font-(family-name:--font-mono) text-[11.5px] text-(--module-scope-text-tertiary)">{config.baseUrl}</p>
                  </div>
                  <span className="flex-none text-[11.5px] text-(--module-scope-text-secondary)">{secretStatus[config.id] ? "密钥已配置" : "未配置密钥"}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-(--module-scope-border-subtle) pt-3">
                  <span className="text-[12px] text-(--module-scope-text-secondary)">默认模型：<span className="font-(family-name:--font-mono) text-(--module-scope-text-primary)">{config.defaultModelId}</span></span>
                  <div className="flex flex-wrap justify-end gap-2">
                    {config.id !== defaultProviderConfigId && <button type="button" onClick={() => void setDefaultProvider(config.id)} disabled={busy} className="rounded-(--r-sm) border-none bg-transparent px-2 py-1 text-[12px] text-(--module-scope-action-strong)">设为默认</button>}
                    <button type="button" onClick={() => { clearError(); setEditingId(config.id); }} disabled={busy} className="rounded-(--r-sm) border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) px-2 py-1 text-[12px] text-(--module-scope-text-primary)">编辑</button>
                    <button type="button" onClick={() => setDeleteTarget(config)} disabled={busy} className="rounded-(--r-sm) border-none bg-transparent px-2 py-1 text-[12px] text-(--module-scope-feedback-danger)">删除</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {deleteTarget && (
        <ConfirmDialog
          title={`删除服务「${deleteTarget.name}」？`}
          body="这会删除对应的 macOS Keychain 项和服务配置，但不会删除任何 AI 会话数据。此操作无法撤销。"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </section>
  );
}

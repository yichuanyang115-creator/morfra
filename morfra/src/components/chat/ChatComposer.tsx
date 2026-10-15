import type { FormEvent, KeyboardEvent } from "react";

export interface ChatModelOption { providerConfigId: string; modelId: string; providerName: string; }

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  disabled: boolean;
  generating: boolean;
  selectionReferenced: boolean;
  selectedCount: number;
  mode: "table-analysis" | "general";
  modelOptions: ChatModelOption[];
  selectedModel: ChatModelOption | null;
  onModelChange: (option: ChatModelOption) => void;
}

export function ChatComposer({ value, onChange, onSubmit, onStop, disabled, generating, selectionReferenced, selectedCount, mode, modelOptions, selectedModel, onModelChange }: ChatComposerProps) {
  const submit = (event: FormEvent) => { event.preventDefault(); if (!disabled && !generating) onSubmit(); };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!disabled && !generating) onSubmit(); } };
  return <form onSubmit={submit} className="flex flex-none flex-col gap-1.5 border-t border-(--module-scope-border-subtle) p-2.5" aria-label="AI 输入"><div className="flex items-center gap-1.5"><span className="text-[11px] text-(--module-scope-text-tertiary)">{selectionReferenced ? `本次引用已选 ${selectedCount} 条` : mode === "general" ? "按问题判断表格上下文" : "整张表"}</span><label className="ml-auto flex min-w-0 items-center gap-1 text-[10.5px] text-(--module-scope-text-tertiary)"><span className="sr-only">选择模型</span><select aria-label="选择模型" value={selectedModel ? `${selectedModel.providerConfigId}::${selectedModel.modelId}` : ""} onChange={(event) => { const next = modelOptions.find((option) => `${option.providerConfigId}::${option.modelId}` === event.target.value); if (next) onModelChange(next); }} disabled={generating || modelOptions.length === 0} className="max-w-40 truncate border-none bg-transparent p-0 text-[10.5px] text-(--module-scope-text-tertiary) outline-none"><option value="">选择模型</option>{modelOptions.map((option) => <option key={`${option.providerConfigId}::${option.modelId}`} value={`${option.providerConfigId}::${option.modelId}`}>{option.providerName} · {option.modelId}</option>)}</select></label></div><div className="flex items-end gap-1.5"><textarea aria-label="输入问题" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={keyDown} placeholder="输入问题，Enter 发送，Shift+Enter 换行" rows={2} disabled={disabled || generating} className="min-h-9 min-w-0 flex-1 resize-none rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1.5 text-[12.5px] text-(--module-scope-text-primary) outline-none" />{generating ? <button type="button" aria-label="停止生成" onClick={onStop} className="grid size-8 flex-none place-items-center rounded-(--r-sm) border border-(--module-scope-feedback-danger) bg-transparent text-[11px] text-(--module-scope-feedback-danger)">停止</button> : <button type="submit" aria-label="发送" disabled={disabled || !value.trim() || modelOptions.length === 0} className="grid size-8 flex-none place-items-center rounded-(--r-sm) border-none bg-(--module-scope-action-strong) text-[11px] text-(--module-scope-background-surface) disabled:cursor-not-allowed disabled:opacity-40">发送</button>}</div></form>;
}

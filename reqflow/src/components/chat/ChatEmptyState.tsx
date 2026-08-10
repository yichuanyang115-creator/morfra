import type { AIConversationMode } from "../../types/ai";
import type { TableSnapshot } from "../../lib/ai/tableDataAdapter";

interface ChatEmptyStateProps {
  configured: boolean;
  tableName?: string;
  recordCount?: number;
  selectedCount: number;
  snapshot?: TableSnapshot;
  mode: AIConversationMode;
  onOpenSettings: () => void;
  onModeChange: (mode: AIConversationMode) => void;
  onSuggestion: (question: string) => void;
}

export function ChatEmptyState({ configured, tableName, recordCount, selectedCount, snapshot, mode, onOpenSettings, onModeChange, onSuggestion }: ChatEmptyStateProps) {
  if (!configured) return <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-5 text-center"><div className="grid size-9 place-items-center rounded-(--r-full) bg-(--module-scope-context-soft) text-(--module-scope-context-strong)" aria-hidden="true">✦</div><h2 className="m-0 text-[13px] font-[590] text-(--module-scope-text-primary)">配置 AI 服务后开始</h2><p className="m-0 max-w-64 text-[12px] text-(--module-scope-text-secondary)">先在应用设置中配置兼容的 AI 服务，凭据由系统密钥存储保护。</p><button type="button" onClick={onOpenSettings} className="mt-1 rounded-(--r-sm) border-none bg-(--module-scope-action-strong) px-3 py-1.5 text-[12px] text-(--module-scope-background-surface)">前往 AI 服务设置</button></div>;
  const suggestions = ["总结这张表"];
  if (selectedCount > 0) suggestions.push("总结已选记录");
  if (snapshot?.fields.some((field) => field.type === "singleSelect")) suggestions.push("分析各选项分布");
  if (snapshot?.fields.some((field) => field.type === "date")) suggestions.push("查看时间安排和临期记录");
  if (snapshot?.fields.some((field) => field.type === "percent" || /进度/iu.test(field.name))) suggestions.push("找出低进度记录");
  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center"><h2 className="m-0 text-[14px] font-[590] text-(--module-scope-text-primary)">{tableName ?? "当前表"}</h2><p className="m-0 text-[12px] text-(--module-scope-text-secondary)">{recordCount === 0 ? "这张表还没有记录。" : `${recordCount ?? 0} 条记录，想先了解什么？`}</p><div role="tablist" aria-label="创建对话模式" className="mt-2 flex rounded-(--r-sm) bg-(--module-scope-background-canvas) p-0.5"><button type="button" role="tab" aria-selected={mode === "table-analysis"} onClick={() => onModeChange("table-analysis")} className={`rounded-(--r-sm) border-none px-2 py-1 text-[11.5px] ${mode === "table-analysis" ? "bg-(--module-scope-background-surface) text-(--module-scope-text-primary)" : "bg-transparent text-(--module-scope-text-secondary)"}`}>表格分析</button><button type="button" role="tab" aria-selected={mode === "general"} onClick={() => onModeChange("general")} className={`rounded-(--r-sm) border-none px-2 py-1 text-[11.5px] ${mode === "general" ? "bg-(--module-scope-background-surface) text-(--module-scope-text-primary)" : "bg-transparent text-(--module-scope-text-secondary)"}`}>通用对话</button></div>{mode === "table-analysis" && recordCount === 0 && <p className="m-0 text-[11.5px] text-(--module-scope-text-tertiary)">表格分析暂不可用，可以切换到通用对话。</p>}<div className="mt-2 flex max-w-72 flex-wrap justify-center gap-1.5">{suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={mode === "table-analysis" && recordCount === 0} onClick={() => onSuggestion(suggestion)} className="rounded-(--r-full) border border-(--module-scope-border-subtle) bg-transparent px-2.5 py-1 text-[11.5px] text-(--module-scope-text-secondary) hover:border-(--module-scope-context-strong) hover:text-(--module-scope-context-strong) disabled:cursor-not-allowed disabled:opacity-50">{suggestion}</button>)}</div></div>;
}

import type { AIContextRef, AIConversationMode } from "../../types/ai";

interface ChatContextBarProps {
  mode: AIConversationMode;
  tableName?: string;
  recordCount?: number;
  contextRef?: AIContextRef | null;
  selectedCount: number;
  selectionReferenced: boolean;
  onToggleSelection: () => void;
}

export function ChatContextBar({ mode, tableName, recordCount, contextRef, selectedCount, selectionReferenced, onToggleSelection }: ChatContextBarProps) {
  const isSelectedScope = selectionReferenced || contextRef?.type === "selectedRecords";
  const contextText = mode === "general" && contextRef?.type === "none"
    ? "未读取当前表"
    : isSelectedScope
      ? `已选 ${contextRef?.type === "selectedRecords" ? contextRef.recordIds.length : selectedCount} 条`
      : mode === "general" && !contextRef
        ? "等待提问"
        : `整张表${recordCount === undefined ? "" : ` · ${recordCount} 条`}`;

  return (
    <div className="flex min-h-9 flex-none items-center gap-2 border-b border-(--module-scope-border-subtle) bg-(--module-scope-background-canvas) px-3 py-1.5 text-[11.5px] text-(--module-scope-text-secondary)" data-testid="chat-context-bar">
      <span className="min-w-0 flex-1 truncate"><span className="text-(--module-scope-text-tertiary)">{tableName ?? "当前表"}</span><span aria-hidden="true" className="px-1 text-(--module-scope-text-tertiary)">·</span><span>{contextText}</span></span>
      {selectedCount > 0 && mode === "table-analysis" && <button type="button" onClick={onToggleSelection} aria-pressed={selectionReferenced} className={`flex-none rounded-(--r-full) border px-2 py-0.5 text-[11px] ${selectionReferenced ? "border-(--module-scope-context-strong) bg-(--module-scope-context-soft) text-(--module-scope-context-strong)" : "border-(--module-scope-border-subtle) bg-transparent text-(--module-scope-text-secondary) hover:border-(--module-scope-context-strong)"}`}>{selectionReferenced ? "已引用所选" : `引用已选 ${selectedCount} 条`}</button>}
    </div>
  );
}

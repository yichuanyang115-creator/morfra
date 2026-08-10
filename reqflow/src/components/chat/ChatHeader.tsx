import type { AIConversationMode } from "../../types/ai";

interface ChatHeaderProps {
  mode: AIConversationMode;
  historyOpen: boolean;
  onModeChange: (mode: AIConversationMode) => void;
  onOpenHistory: () => void;
  onNewConversation: () => void;
  onClose: () => void;
}

function PlusIcon() {
  return <span aria-hidden="true" className="text-[16px] leading-none">+</span>;
}

export function ChatHeader({ mode, historyOpen, onModeChange, onOpenHistory, onNewConversation, onClose }: ChatHeaderProps) {
  return (
    <header className="flex min-h-10 flex-none items-center gap-1 border-b border-(--module-scope-border-subtle) px-2.5" data-testid="chat-header">
      <div role="tablist" aria-label="AI 对话模式" className="flex min-w-0 flex-1 items-center gap-0.5">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "table-analysis"}
          onClick={() => onModeChange("table-analysis")}
          className={`min-w-0 truncate rounded-(--r-sm) border-none px-2 py-1 text-[12px] ${mode === "table-analysis" && !historyOpen ? "bg-(--module-scope-context-soft) font-[590] text-(--module-scope-context-strong)" : "bg-transparent text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft)"}`}
        >表格分析</button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "general"}
          onClick={() => onModeChange("general")}
          className={`min-w-0 truncate rounded-(--r-sm) border-none px-2 py-1 text-[12px] ${mode === "general" && !historyOpen ? "bg-(--module-scope-context-soft) font-[590] text-(--module-scope-context-strong)" : "bg-transparent text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft)"}`}
        >通用对话</button>
      </div>
      <button type="button" aria-label="新建对话" title="新建对话" onClick={onNewConversation} className="grid size-6 place-items-center rounded-(--r-sm) border-none bg-transparent text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)"><PlusIcon /></button>
      <button type="button" aria-label={historyOpen ? "返回当前对话" : "查看历史"} onClick={onOpenHistory} className={`rounded-(--r-sm) border-none px-1.5 py-1 text-[11.5px] ${historyOpen ? "bg-(--module-scope-context-soft) text-(--module-scope-context-strong)" : "bg-transparent text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft)"}`}>{historyOpen ? "返回" : "历史"}</button>
      <button type="button" aria-label="收起 AI 面板" onClick={onClose} className="grid size-6 place-items-center rounded-(--r-sm) border-none bg-transparent text-[17px] leading-none text-(--module-scope-text-tertiary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-text-primary)">×</button>
    </header>
  );
}

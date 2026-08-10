import { useState } from "react";
import type { AIConversation, AIConversationMode } from "../../types/ai";

interface ChatHistoryViewProps {
  conversations: AIConversation[];
  currentConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onRename: (conversationId: string, title: string) => void;
  onDelete: (conversationId: string) => void;
  onBack: () => void;
}

const modeLabel: Record<AIConversationMode, string> = { "table-analysis": "表格分析", general: "通用对话" };

export function ChatHistoryView({ conversations, currentConversationId, onSelect, onRename, onDelete, onBack }: ChatHistoryViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  return <section className="flex min-h-0 flex-1 flex-col" aria-label="当前表对话历史"><div className="flex items-center justify-between border-b border-(--module-scope-border-subtle) px-3 py-2"><h2 className="m-0 text-[12.5px] font-[590] text-(--module-scope-text-primary)">当前表历史</h2><button type="button" onClick={onBack} className="border-none bg-transparent p-0 text-[11.5px] text-(--module-scope-action-strong)">返回对话</button></div>{conversations.length === 0 ? <p className="m-0 p-4 text-center text-[12px] text-(--module-scope-text-secondary)">还没有会话，点击顶部 + 新建。</p> : <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-2">{conversations.map((conversation) => <li key={conversation.id} className={`group rounded-(--r-sm) ${conversation.id === currentConversationId ? "bg-(--module-scope-context-soft)" : "hover:bg-(--module-scope-background-canvas)"}`}><div className="flex items-center gap-1.5 px-2 py-2"><button type="button" onClick={() => onSelect(conversation.id)} className="min-w-0 flex-1 truncate border-none bg-transparent p-0 text-left text-[12px] text-(--module-scope-text-primary)">{conversation.title}<span className="ml-1.5 text-[10.5px] text-(--module-scope-text-tertiary)">{modeLabel[conversation.mode]}</span></button><button type="button" aria-label={`重命名${conversation.title}`} onClick={() => { setEditingId(conversation.id); setDraft(conversation.title); }} className="invisible rounded p-0.5 text-[11px] text-(--module-scope-text-tertiary) group-hover:visible hover:text-(--module-scope-action-strong)">改</button><button type="button" aria-label={`删除${conversation.title}`} onClick={() => { if (window.confirm(`删除会话“${conversation.title}”？`)) onDelete(conversation.id); }} className="invisible rounded p-0.5 text-[11px] text-(--module-scope-text-tertiary) group-hover:visible hover:text-(--module-scope-feedback-danger)">删</button></div>{editingId === conversation.id && <form className="flex gap-1 px-2 pb-2" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) onRename(conversation.id, draft); setEditingId(null); }}><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="会话标题" className="min-w-0 flex-1 rounded border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-1.5 py-1 text-[11.5px]" /><button type="submit" className="rounded border-none bg-(--module-scope-action-strong) px-1.5 text-[11px] text-(--module-scope-background-surface)">保存</button></form>}</li>)}</ul>}</section>;
}

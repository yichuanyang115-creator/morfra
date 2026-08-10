import { useState } from "react";
import { messageText } from "../../lib/ai/messagePersistence";
import type { AIMessage } from "../../types/ai";
import { AnalysisAnswer } from "./AnalysisAnswer";
import type { AIHostActions } from "./chatTypes";

interface ChatMessageProps {
  message: AIMessage;
  tableId: string;
  hostActions?: AIHostActions;
  onRetry: (messageId: string) => void;
  onCopy: (messageId: string) => void;
}

export function ChatMessage({ message, tableId, hostActions, onRetry, onCopy }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const handleCopy = () => { onCopy(message.id); setCopied(true); window.setTimeout(() => setCopied(false), 1200); };
  return <article data-role={message.role} aria-label={isUser ? "用户消息" : "AI 消息"} className={`flex min-w-0 flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
    <div className={`max-w-full break-words rounded-(--r-md) px-2.5 py-2 ${isUser ? "bg-(--module-scope-context-soft) text-(--module-scope-action-strong)" : "bg-transparent text-(--module-scope-text-primary)"}`}>
      {isUser ? <p className="m-0 whitespace-pre-wrap text-[12.5px] leading-5">{messageText(message)}</p> : <AnalysisAnswer blocks={message.contentBlocks} tableId={tableId} hostActions={hostActions} />}
      {!isUser && (message.status === "pending" || message.status === "streaming") && <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-(--module-scope-context-strong)" aria-label="正在生成"><span className="size-1.5 animate-pulse rounded-full bg-(--module-scope-context-strong)" /><span>正在生成…</span></span>}
      {!isUser && message.status === "stopped" && <p className="m-0 mt-1 text-[11px] text-(--module-scope-text-secondary)">已停止，已保留当前内容。</p>}
      {!isUser && message.status === "failed" && <div role="alert" className="mt-2 rounded-(--r-sm) bg-(--module-scope-feedback-danger-soft) px-2 py-1.5 text-[11.5px] text-(--module-scope-feedback-danger)"><p className="m-0">{message.errorMessage ?? "这次生成失败，请重试。"}</p><button type="button" onClick={() => onRetry(message.id)} className="mt-1 rounded border-none bg-transparent p-0 text-(--module-scope-feedback-danger) underline">重试</button></div>}
    </div>
    {!isUser && message.status !== "pending" && <div className="flex items-center gap-2 px-2.5 text-[11px] text-(--module-scope-text-tertiary)"><button type="button" onClick={handleCopy} className="border-none bg-transparent p-0 hover:text-(--module-scope-action-strong)">{copied ? "已复制" : "复制"}</button></div>}
  </article>;
}

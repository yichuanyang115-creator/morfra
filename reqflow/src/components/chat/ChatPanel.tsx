import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../../stores/chatStore";

function TrashIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path
        d="M4.5 6h11M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6m-6.5 0 .6 9a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M17 3 3 9.5l6 1.5 1.5 6L17 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

interface ChatPanelProps {
  width: number | null;
}

export function ChatPanel({ width }: ChatPanelProps) {
  const messages = useChatStore((s) => s.messages);
  const thinking = useChatStore((s) => s.thinking);
  const persistenceError = useChatStore((s) => s.persistenceError);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearChat = useChatStore((s) => s.clearChat);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thinking]);

  if (width == null) return null;

  function handleSend() {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  }

  return (
    <div
      data-theme-module="chat"
      className="theme-module-chat flex h-full min-w-0 flex-none flex-col border-l border-(--border) bg-(--surface)"
      style={{ width: `${width}px` }}
    >
      <div className="flex flex-none items-center justify-end border-b border-(--border) px-2.5 py-1.5">
        <button
          type="button"
          aria-label="清空对话"
          onClick={() => void clearChat()}
          className="grid size-6.5 place-items-center rounded-(--r-sm) border-none bg-transparent text-(--muted) hover:bg-(--surface) hover:text-(--st-blocked)"
        >
          <TrashIcon />
        </button>
      </div>
      {persistenceError && <p role="alert" className="m-0 border-b border-(--st-blocked) px-2.5 py-1 text-[11px] text-(--st-blocked)">{persistenceError}</p>}

      <div ref={scrollRef} role="log" aria-live="polite" aria-label="对话消息" className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {messages.length === 0 && !thinking ? (
          <p className="m-0 px-1 py-3 text-center text-[12px] text-(--muted-2)">随便聊点什么…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <div
                key={m.id}
                data-role={m.role}
                aria-label={m.role === "user" ? "用户消息" : "AI 消息"}
                className={`max-w-full break-words rounded-(--r-md) px-2.5 py-1.5 text-[12.5px] ${
                  m.role === "user"
                    ? "self-end bg-(--accent-soft-strong) text-(--accent-text)"
                    : "self-start bg-transparent text-(--fg)"
                }`}
              >
                {m.content}
              </div>
            ))}
            {thinking && (
              <div aria-label="对话运行中" className="self-start rounded-(--r-md) bg-transparent px-2.5 py-1.5 text-[12.5px] text-(--context-strong)">
                <span className="sr-only">思考中…</span>
                <span aria-hidden="true" className="inline-flex items-center gap-1">
                  <span className="size-1.5 animate-pulse rounded-full bg-(--context-strong)" />
                  <span className="size-1.5 animate-pulse rounded-full bg-(--context-strong) [animation-delay:150ms]" />
                  <span className="size-1.5 animate-pulse rounded-full bg-(--context-strong) [animation-delay:300ms]" />
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex flex-none items-end gap-1.5 border-t border-(--border) p-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="输入消息，回车发送…"
          rows={1}
          className="min-h-8 flex-1 resize-none rounded-(--r-sm) border border-(--border) bg-(--surface) px-2 py-1.5 font-(family-name:--font-body) text-[12.5px] text-(--fg) outline-none focus:border-(--accent)"
        />
        <button
          type="submit"
          aria-label="发送"
          className="grid size-8 flex-none place-items-center rounded-(--r-sm) border-none bg-(--accent-solid) text-(--accent-solid-fg) disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!input.trim()}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

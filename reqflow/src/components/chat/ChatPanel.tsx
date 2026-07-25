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
      className="flex h-full min-w-0 flex-none flex-col border-l border-(--border) bg-(--surface-2)"
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

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {messages.length === 0 && !thinking ? (
          <p className="m-0 px-1 py-3 text-center text-[12px] text-(--muted-2)">随便聊点什么…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-full break-words rounded-(--r-md) px-2.5 py-1.5 text-[12.5px] ${
                  m.role === "user"
                    ? "self-end bg-(--accent-soft) text-(--accent-text)"
                    : "self-start bg-(--surface) text-(--fg)"
                }`}
              >
                {m.content}
              </div>
            ))}
            {thinking && (
              <div className="self-start rounded-(--r-md) bg-(--surface) px-2.5 py-1.5 text-[12.5px] text-(--muted-2)">
                <span className="inline-block animate-pulse">思考中…</span>
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
          className="grid size-8 flex-none place-items-center rounded-(--r-sm) border-none bg-(--fg) text-(--surface) disabled:opacity-40"
          disabled={!input.trim()}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

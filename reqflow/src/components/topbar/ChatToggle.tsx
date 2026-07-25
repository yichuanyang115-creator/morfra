import { useChatStore } from "../../stores/chatStore";

function ChatIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path
        d="M3 4.5h14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8l-3.5 3v-3H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ChatToggleProps {
  spaceAvailable: boolean;
}

export function ChatToggle({ spaceAvailable }: ChatToggleProps) {
  const open = useChatStore((s) => s.open);
  const toggleOpen = useChatStore((s) => s.toggleOpen);
  const disabled = !spaceAvailable;

  return (
    <button
      type="button"
      aria-label={open ? "关闭对话框" : "打开对话框"}
      aria-pressed={open}
      disabled={disabled}
      title={disabled ? "拖宽详情面板后可使用" : undefined}
      onClick={() => void toggleOpen()}
      className={`grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none text-(--muted) disabled:cursor-not-allowed disabled:opacity-40 ${
        open ? "bg-(--accent-soft) text-(--accent-text)" : "bg-transparent hover:bg-(--surface) hover:text-(--fg)"
      }`}
    >
      <ChatIcon />
    </button>
  );
}

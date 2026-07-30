import { useEffect } from "react";

const AUTO_DISMISS_MS = 2500;

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-5 left-1/2 z-70 -translate-x-1/2 rounded-(--r-md) bg-(--fg) px-3.5 py-2 text-[12.5px] text-(--surface) shadow-[0_12px_32px_-8px_rgba(30,40,70,0.28)]">
      {message}
    </div>
  );
}

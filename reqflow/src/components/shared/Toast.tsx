import { useEffect } from "react";

const AUTO_DISMISS_MS = 2500;

interface ToastProps {
  message: string;
  onDismiss: () => void;
  tone?: ToastTone;
}

export type ToastTone = "info" | "success" | "warning" | "danger";

const TONE_STYLE: Record<ToastTone, { border: string; text: string; symbol: string }> = {
  info: { border: "border-l-(--context-strong)", text: "text-(--context-strong)", symbol: "i" },
  success: { border: "border-l-(--st-done)", text: "text-(--st-done)", symbol: "✓" },
  warning: { border: "border-l-(--sev-p1)", text: "text-(--sev-p1)", symbol: "!" },
  danger: { border: "border-l-(--st-blocked)", text: "text-(--st-blocked)", symbol: "!" },
};

export function Toast({ message, onDismiss, tone = "info" }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const style = TONE_STYLE[tone];

  return (
    <div role="status" aria-live="polite" className={`theme-module-feedback fixed bottom-5 left-1/2 z-70 flex max-w-[min(90vw,520px)] -translate-x-1/2 items-center gap-2 rounded-(--r-md) border border-(--border) border-l-2 bg-(--surface) px-3.5 py-2 text-[12.5px] text-(--fg) shadow-(--shadow-floating) ${style.border}`}>
      <span aria-hidden="true" className={`font-(family-name:--font-mono) text-[12px] font-[650] ${style.text}`}>
        {style.symbol}
      </span>
      <span>{message}</span>
    </div>
  );
}

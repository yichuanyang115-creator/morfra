import type { ReactNode } from "react";

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({ title, body, confirmLabel = "删除", onConfirm, onCancel, children }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-[rgba(30,38,60,0.28)]">
      <div className="w-75 rounded-(--r-lg) bg-(--surface) p-4.5 shadow-[0_24px_60px_-12px_rgba(25,35,65,0.28)]">
        <h4 className="m-0 mb-1.5 font-(family-name:--font-display) text-[14px] text-(--fg)">{title}</h4>
        <p className="m-0 mb-4 text-[12.5px] text-(--muted)">{body}</p>
        {children}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-(--r-sm) border border-(--border-strong) bg-(--surface) px-3.25 py-1.5 text-[12.5px] text-(--fg)"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-(--r-sm) border border-transparent bg-(--st-blocked) px-3.25 py-1.5 text-[12.5px] text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

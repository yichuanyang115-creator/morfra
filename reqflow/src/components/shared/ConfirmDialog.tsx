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
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-(--overlay-scrim)">
      <div className="w-75 rounded-(--r-lg) bg-(--module-scope-background-surface) p-4.5 shadow-(--shadow-dialog)">
        <h4 className="m-0 mb-1.5 font-(family-name:--font-display) text-[14px] text-(--module-scope-text-primary)">{title}</h4>
        <p className="m-0 mb-4 text-[12.5px] text-(--module-scope-text-secondary)">{body}</p>
        {children}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-(--r-sm) border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) px-3.25 py-1.5 text-[12.5px] text-(--module-scope-text-primary)"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-(--r-sm) border border-transparent bg-(--module-scope-feedback-danger) px-3.25 py-1.5 text-[12.5px] text-(--module-scope-background-surface)"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

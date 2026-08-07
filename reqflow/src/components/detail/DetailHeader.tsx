import { useState } from "react";
import type { Requirement } from "../../types/models";
import { ConfirmDialog } from "../shared/ConfirmDialog";

function FullscreenExitIcon() {
  return (
    <svg className="icon icon-sm" viewBox="0 0 20 20" fill="none">
      <path
        d="M8 12l-5 5M12 8l5-5M3 13v4h4M17 7V3h-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FullscreenEnterIcon() {
  return (
    <svg className="icon icon-sm" viewBox="0 0 20 20" fill="none">
      <path
        d="M13 7h4V3M7 13H3v4M17 3l-5.5 5.5M3 17l5.5-5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="icon icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M6 6h8m-7 0 .6 10h4.8l.6-10M8 6V4h4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface DetailHeaderProps {
  requirement: Requirement;
  fullscreen: boolean;
  onRename: (name: string) => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function DetailHeader({ requirement, fullscreen, onRename, onToggleFullscreen, onClose, onDelete = () => undefined }: DetailHeaderProps) {
  const [name, setName] = useState(requirement.name);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex flex-none items-center gap-2 border-b border-(--border) px-4.5 pt-4 pb-3.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name !== requirement.name) onRename(name);
        }}
        className="min-w-0 flex-1 rounded-(--r-sm) border-none bg-transparent px-1.5 py-0.5 font-(family-name:--font-display) text-[20px] font-[590] tracking-[-0.01em] text-(--fg) outline-none hover:bg-(--accent-soft) focus:bg-(--accent-soft)"
      />
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        aria-label="永久删除实体"
        className="grid size-7 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent text-(--context-strong) hover:bg-(--st-blocked-soft) hover:text-(--st-blocked)"
      >
        <DeleteIcon />
      </button>
      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={fullscreen ? "退出全屏" : "全屏"}
        className="grid size-7 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent text-(--muted) hover:bg-(--accent-soft) hover:text-(--accent-text)"
      >
        {fullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        className="grid size-7 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent text-(--muted) hover:bg-(--accent-soft) hover:text-(--accent-text)"
      >
        <CloseIcon />
      </button>
      {deleteOpen && (
        <ConfirmDialog
          title={`永久删除「${requirement.name}」？`}
          body="该实体及其所有 Tab 记录、流转记录和评论将被永久删除，此操作无法撤销。"
          confirmLabel="永久删除"
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => {
            onDelete();
            setDeleteOpen(false);
          }}
        />
      )}
    </div>
  );
}

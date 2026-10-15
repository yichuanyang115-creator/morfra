import { useState } from "react";
import type { Comment, TransitionRecord } from "../../../types/models";
import { fmtDateTime } from "./activityShared";

function CloseIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TimelineNode({
  transition,
  stageLabel,
  isCurrent,
  comments,
  onUpdateNote,
  onAddComment,
  onDelete,
}: {
  transition: TransitionRecord;
  stageLabel: string;
  isCurrent: boolean;
  comments: Comment[];
  onUpdateNote: (note: string) => void;
  onAddComment: (content: string) => void;
  onDelete: () => void;
}) {
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteValue, setNoteValue] = useState(transition.note);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentValue, setCommentValue] = useState("");

  function submitComment() {
    const trimmed = commentValue.trim();
    if (trimmed) onAddComment(trimmed);
    setCommentValue("");
    setCommentOpen(false);
  }

  return (
    <div className="theme-module-business relative pb-5 last:pb-0">
      <span
        className={`absolute top-0.5 -left-5 size-2.75 rounded-full border-2 ${
          isCurrent ? "border-(--module-scope-action-base) bg-(--module-scope-action-base)" : "border-(--module-scope-context-strong) bg-(--module-scope-background-surface)"
        }`}
      />
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="font-(family-name:--font-display) text-[13px] font-[590] text-(--module-scope-text-primary)">{stageLabel}</span>
        <span className="font-(family-name:--font-mono) text-[11px] text-(--module-scope-text-tertiary)">
          {fmtDateTime(transition.timestamp)} · {transition.by}
        </span>
        <button
          type="button"
          aria-label="删除该流转记录"
          onClick={onDelete}
          className="ml-auto grid size-5 flex-none place-items-center rounded-(--r-sm) text-transparent hover:bg-(--module-scope-feedback-danger-soft) hover:text-(--module-scope-feedback-danger)"
        >
          <CloseIcon />
        </button>
      </div>
      {noteEditing ? (
        <textarea
          autoFocus
          placeholder="补充这次流转的说明…"
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
          onBlur={() => {
            onUpdateNote(noteValue.trim());
            setNoteEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setNoteValue(transition.note);
              setNoteEditing(false);
            }
          }}
          className="mb-1 min-h-11 w-full resize-y rounded-(--r-sm) border border-(--module-scope-border-strong) bg-(--module-scope-background-elevated) px-2 py-1.5 font-(family-name:--font-body) text-[12px] text-(--module-scope-text-primary) outline-none focus:border-(--module-scope-action-base)"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setNoteValue(transition.note);
            setNoteEditing(true);
          }}
          className="mb-0.5 block max-w-full truncate rounded-(--r-sm) px-1 py-0.5 text-left font-(family-name:--font-body) text-[12px] text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)"
        >
          {transition.note || "点击添加说明…"}
        </button>
      )}
      {comments.map((c) => (
        <div key={c.id} className="mt-1 rounded-(--r-sm) bg-(--module-scope-background-elevated) px-2.25 py-1.75 text-[12.5px] text-(--module-scope-text-primary)">
          <div className="mb-0.5 font-(family-name:--font-mono) text-[10.5px] text-(--module-scope-text-tertiary)">
            {fmtDateTime(c.timestamp)}
          </div>
          {c.content}
        </div>
      ))}
      {commentOpen ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitComment();
          }}
          className="mt-1"
        >
          <input
            type="text"
            autoFocus
            placeholder="写评论，回车发送"
            value={commentValue}
            onChange={(e) => setCommentValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setCommentOpen(false);
            }}
            className="w-full rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1.25 font-(family-name:--font-body) text-[12px] text-(--module-scope-text-primary) outline-none focus:border-(--module-scope-action-base)"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCommentOpen(true)}
          className="mt-1 rounded-(--r-sm) px-1 py-0.5 font-(family-name:--font-body) text-[11.5px] text-(--module-scope-text-tertiary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)"
        >
          + 评论
        </button>
      )}
    </div>
  );
}

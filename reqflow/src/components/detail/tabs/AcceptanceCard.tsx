import { useState } from "react";
import type { AcceptanceCriterion } from "../../../types/models";
import {
  ACCEPTANCE_RESULT_LABEL,
  ACCEPTANCE_RESULT_ORDER,
  RESULT_BTN_STYLE,
  resultBtnBaseClass,
  type AcceptancePatch,
} from "./acceptanceShared";

function CloseIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function AcceptanceCard({
  criterion,
  onUpdate,
  onRemove,
}: {
  criterion: AcceptanceCriterion;
  onUpdate: (patch: AcceptancePatch) => void;
  onRemove: () => void;
}) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(criterion.desc);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteValue, setNoteValue] = useState(criterion.failNote);

  function commitDesc() {
    const trimmed = descValue.trim();
    if (trimmed && trimmed !== criterion.desc) onUpdate({ desc: trimmed });
    else setDescValue(criterion.desc);
    setEditingDesc(false);
  }

  return (
    <div
      className={`relative mb-1.5 flex flex-col gap-1.5 rounded-(--r-md) border p-2.25 last:mb-0 ${
        criterion.result === "fail" ? "border-(--st-blocked)" : "border-(--border)"
      }`}
    >
      {criterion.result === "fail" && (
        <span className="absolute top-2 bottom-2 left-0 w-0.75 rounded-r-sm bg-(--st-blocked)" />
      )}
      <div className="flex items-center gap-2">
        {editingDesc ? (
          <input
            type="text"
            autoFocus
            placeholder="验收标准描述"
            value={descValue}
            onChange={(e) => setDescValue(e.target.value)}
            onBlur={commitDesc}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              else if (e.key === "Escape") {
                setDescValue(criterion.desc);
                setEditingDesc(false);
              }
            }}
            className="min-w-0 flex-1 rounded-(--r-sm) border border-transparent bg-transparent px-1.5 py-1 font-(family-name:--font-body) text-[13px] text-(--fg) outline-none hover:border-(--border) hover:bg-(--surface) focus:border-(--border) focus:bg-(--surface)"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDescValue(criterion.desc);
              setEditingDesc(true);
            }}
            className="min-w-0 flex-1 truncate rounded-(--r-sm) border border-transparent bg-transparent px-1.5 py-1 text-left font-(family-name:--font-body) text-[13px] text-(--fg) outline-none hover:border-(--border) hover:bg-(--surface)"
          >
            {criterion.desc}
          </button>
        )}
        <div className="flex flex-none items-center gap-1">
          {ACCEPTANCE_RESULT_ORDER.map((result) => (
            <button
              key={result}
              type="button"
              aria-pressed={criterion.result === result}
              onClick={() => onUpdate({ result })}
              className={`${resultBtnBaseClass} ${criterion.result === result ? RESULT_BTN_STYLE[result] : ""}`}
            >
              {ACCEPTANCE_RESULT_LABEL[result]}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="删除验收标准"
          onClick={onRemove}
          className="grid size-6 flex-none place-items-center rounded-(--r-sm) bg-(--surface-2) text-(--muted-2) hover:bg-(--st-blocked-soft) hover:text-(--st-blocked)"
        >
          <CloseIcon />
        </button>
      </div>
      {criterion.result === "fail" &&
        (noteOpen ? (
          <textarea
            autoFocus
            placeholder="为什么不通过？"
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            onBlur={() => {
              onUpdate({ failNote: noteValue.trim() });
              setNoteOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setNoteValue(criterion.failNote);
                setNoteOpen(false);
              }
            }}
            className="min-h-11 w-full resize-y rounded-(--r-sm) border border-(--st-blocked) bg-(--st-blocked-soft) px-2 py-1.5 font-(family-name:--font-body) text-[12px] text-(--fg) outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNoteValue(criterion.failNote);
              setNoteOpen(true);
            }}
            className="block max-w-full truncate rounded-(--r-sm) px-1 py-0.5 text-left font-(family-name:--font-body) text-[11.5px] text-(--st-blocked) hover:bg-(--st-blocked-soft)"
          >
            {criterion.failNote || "点击说明不通过原因…"}
          </button>
        ))}
    </div>
  );
}

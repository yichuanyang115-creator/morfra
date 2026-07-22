import { useState } from "react";
import type { Deliverable, DeliverableAttach } from "../../../types/models";
import { linkAttachmentFromUrl, openAttachment, pickAttachmentFile } from "../../../lib/attachments";
import { EmptyState } from "../../shared/EmptyState";

interface DeliverablesTabProps {
  deliverables: Deliverable[];
  draftOpen: boolean;
  onCreate: (name: string) => void;
  onCancelDraft: () => void;
  onUpdate: (deliverableId: string, patch: Partial<Pick<Deliverable, "name" | "checked" | "attach">>) => void;
  onRemove: (deliverableId: string) => void;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-2.5">
      <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 13V4M6.5 7.5 10 4l3.5 3.5M4.5 15h11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function AttachIcon({ type }: { type: DeliverableAttach["type"] }) {
  if (type === "file") {
    return (
      <svg className="size-3.5 flex-none" viewBox="0 0 20 20" fill="none">
        <path
          d="M5.5 3h6l3 3v10.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    );
  }
  return (
    <svg className="size-3.5 flex-none" viewBox="0 0 20 20" fill="none">
      <path
        d="M8 12l4-4m-5 1-1.5 1.5a2.5 2.5 0 0 0 3.5 3.5L10.5 12M12 8l1.5-1.5a2.5 2.5 0 0 0-3.5-3.5L8.5 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DraftRow({ onCreate, onCancel }: { onCreate: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");

  return (
    <div className="mb-1.5 rounded-(--r-md) border border-(--border) p-2.25">
      <input
        type="text"
        autoFocus
        placeholder="产出名称（必填），填完点其他地方或回车即创建"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const trimmed = value.trim();
          if (trimmed) onCreate(trimmed);
          else onCancel();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onCancel();
          } else if (e.key === "Enter") {
            const trimmed = value.trim();
            if (trimmed) onCreate(trimmed);
            else onCancel();
          }
        }}
        className="w-full rounded-(--r-sm) border border-transparent bg-transparent px-1.5 py-1 font-(family-name:--font-body) text-[13px] text-(--fg) outline-none placeholder:text-(--muted-2) focus:border-(--border) focus:bg-(--surface)"
      />
    </div>
  );
}

function DeliverableCard({
  deliverable,
  onUpdate,
  onRemove,
}: {
  deliverable: Deliverable;
  onUpdate: (patch: Partial<Pick<Deliverable, "name" | "checked" | "attach">>) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(deliverable.name);
  const [attachOpen, setAttachOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  async function handleUploadFile() {
    const attach = await pickAttachmentFile();
    if (attach) {
      onUpdate({ attach });
      setAttachOpen(false);
    }
  }

  function commitLink() {
    const trimmed = linkValue.trim();
    if (!trimmed) return;
    onUpdate({ attach: linkAttachmentFromUrl(trimmed) });
    setLinkValue("");
    setAttachOpen(false);
  }

  return (
    <div
      className={`relative mb-1.5 flex flex-col gap-1.5 rounded-(--r-md) border p-2.25 last:mb-0 ${
        deliverable.checked ? "border-(--accent) bg-(--accent-soft)" : "border-(--border)"
      }`}
    >
      {deliverable.checked && (
        <span className="absolute top-2 bottom-2 left-0 w-0.75 rounded-r-sm bg-(--accent)" />
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={deliverable.checked}
          aria-label={deliverable.checked ? "标记为未完成" : "标记为完成"}
          onClick={() => onUpdate({ checked: !deliverable.checked })}
          className={`grid size-4 flex-none place-items-center rounded border-1.5 ${
            deliverable.checked
              ? "border-(--accent) bg-(--accent) text-white"
              : "border-(--border-strong) bg-(--surface) text-transparent"
          }`}
        >
          <CheckIcon />
        </button>
        <input
          type="text"
          value={name}
          placeholder="名称"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (trimmed && trimmed !== deliverable.name) onUpdate({ name: trimmed });
            else if (!trimmed) setName(deliverable.name);
          }}
          className="min-w-0 flex-1 rounded-(--r-sm) border border-transparent bg-transparent px-1.5 py-1 font-(family-name:--font-body) text-[13px] text-(--fg) outline-none hover:border-(--border) hover:bg-(--surface) focus:border-(--border) focus:bg-(--surface)"
        />
        <button
          type="button"
          aria-label="删除这条产出"
          onClick={onRemove}
          className="grid size-6 flex-none place-items-center rounded-(--r-sm) bg-(--surface-2) text-(--muted-2) hover:bg-(--st-blocked-soft) hover:text-(--st-blocked)"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex items-center">
        {deliverable.attach ? (
          <>
            <button
              type="button"
              onClick={() => void openAttachment(deliverable.attach as DeliverableAttach)}
              className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-(--r-sm) bg-(--surface-2) px-2.25 py-1.25 text-left text-[12px] text-(--muted) hover:text-(--accent-text)"
            >
              <AttachIcon type={deliverable.attach.type} />
              <span className="truncate">{deliverable.attach.label}</span>
            </button>
            <button
              type="button"
              aria-label="移除附件（保留这条产出）"
              onClick={() => onUpdate({ attach: null })}
              className="ml-1 grid size-5.5 flex-none place-items-center rounded-(--r-sm) text-(--muted-2) hover:bg-(--st-blocked-soft) hover:text-(--st-blocked)"
            >
              <CloseIcon />
            </button>
          </>
        ) : attachOpen ? (
          <div className="flex w-full gap-1">
            <input
              type="text"
              autoFocus
              placeholder="粘贴链接，回车添加"
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitLink();
                else if (e.key === "Escape") setAttachOpen(false);
              }}
              className="min-w-0 flex-1 rounded-(--r-sm) border border-(--border) bg-(--bg) px-2 py-1.5 text-[12px] text-(--fg) outline-none focus:border-(--accent)"
            />
            <button
              type="button"
              title="上传文件"
              aria-label="上传文件"
              onClick={() => void handleUploadFile()}
              className="grid size-7 flex-none place-items-center rounded-(--r-sm) border border-(--border) bg-(--surface) text-(--muted) hover:border-(--accent) hover:text-(--accent-text)"
            >
              <UploadIcon />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAttachOpen(true)}
            className="flex w-full items-center gap-1.5 rounded-(--r-sm) border border-dashed border-(--border-strong) px-2 py-1.5 text-[12px] text-(--muted) hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-text)"
          >
            <PlusIcon />
            附加文件或链接
          </button>
        )}
      </div>
    </div>
  );
}

export function DeliverablesTab({ deliverables, draftOpen, onCreate, onCancelDraft, onUpdate, onRemove }: DeliverablesTabProps) {
  if (deliverables.length === 0 && !draftOpen) {
    return <EmptyState text="还没有产出，点右上角 + 新建" />;
  }

  return (
    <div>
      {draftOpen && <DraftRow onCreate={onCreate} onCancel={onCancelDraft} />}
      {deliverables.map((deliverable) => (
        <DeliverableCard
          key={deliverable.id}
          deliverable={deliverable}
          onUpdate={(patch) => onUpdate(deliverable.id, patch)}
          onRemove={() => onRemove(deliverable.id)}
        />
      ))}
    </div>
  );
}

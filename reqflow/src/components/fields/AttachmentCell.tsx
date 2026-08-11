import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import type { StorageAttachment } from "../../types/domain";
import { addStorageAttachment, listStorageAttachments, removeStorageAttachment, replaceStorageAttachment, storageAttachmentPath } from "../../lib/ipc/storageClient";

interface AttachmentCellProps { recordId: string; fieldId: string; image: boolean; onChanged: () => Promise<void>; }

export function AttachmentCell({ recordId, fieldId, image, onChanged }: AttachmentCellProps) {
  const [attachments, setAttachments] = useState<StorageAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => { setError(null); try { setAttachments(await listStorageAttachments(recordId, fieldId)); } catch (cause) { setError(message(cause, "附件读取失败，请重试")); } };
  useEffect(() => { void load(); }, [recordId, fieldId]);
  const add = async () => { const selected = await open({ multiple: false, directory: false }); if (typeof selected !== "string") return; setBusy(true); setError(null); try { await addStorageAttachment(recordId, fieldId, selected); await Promise.all([load(), onChanged()]); } catch (cause) { setError(message(cause, "附件复制失败，未保存任何更改")); } finally { setBusy(false); } };
  const remove = async (attachment: StorageAttachment) => { setBusy(true); setError(null); try { await removeStorageAttachment(attachment.id); await Promise.all([load(), onChanged()]); } catch (cause) { setError(message(cause, "附件移除失败，请重试")); } finally { setBusy(false); } };
  const replace = async (attachment: StorageAttachment) => { const selected = await open({ multiple: false, directory: false }); if (typeof selected !== "string") return; setBusy(true); setError(null); try { await replaceStorageAttachment(attachment.id, selected); await Promise.all([load(), onChanged()]); } catch (cause) { setError(message(cause, "附件替换失败，已保留原附件，可重试")); } finally { setBusy(false); } };
  const openAttachment = async (attachment: StorageAttachment) => { setError(null); try { await openPath(await storageAttachmentPath(attachment.id)); } catch (cause) { setError(message(cause, "附件缺失或无法打开；可从备份恢复")); } };
  return <div className="min-w-0 space-y-2"><div className="flex flex-wrap gap-2">{attachments.map((attachment) => <AttachmentItem key={attachment.id} attachment={attachment} image={image} onOpen={openAttachment} onReplace={replace} onRemove={remove} />)}</div><button type="button" disabled={busy} className="rounded-(--r-sm) border border-(--module-scope-border-subtle) px-2 py-1 text-[11px] disabled:opacity-50" onClick={() => void add()}>{busy ? "处理中…" : "添加附件"}</button>{error && <p role="alert" className="m-0 text-[11px] text-(--module-scope-feedback-danger)">{error}<button type="button" className="ml-2 underline" onClick={() => void load()}>重试</button></p>}</div>;
}

function AttachmentItem({ attachment, image, onOpen, onReplace, onRemove }: { attachment: StorageAttachment; image: boolean; onOpen: (attachment: StorageAttachment) => Promise<void>; onReplace: (attachment: StorageAttachment) => Promise<void>; onRemove: (attachment: StorageAttachment) => Promise<void>; }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { let active = true; void storageAttachmentPath(attachment.id).then((path) => { if (active) setUrl(convertFileSrc(path)); }).catch(() => { if (active) setMissing(true); }); return () => { active = false; }; }, [attachment.id]);
  return <span className="inline-flex max-w-full items-center gap-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) p-1 text-[11px]">{image && url && !missing ? <img src={url} alt={attachment.originalName} className="max-h-20 max-w-28 object-contain" onError={() => setMissing(true)} /> : null}<button type="button" className="max-w-32 truncate text-(--module-scope-action-base) underline" onClick={() => void onOpen(attachment)}>{missing ? `${attachment.originalName}（缺失）` : attachment.originalName}</button><button type="button" aria-label={`替换附件 ${attachment.originalName}`} onClick={() => void onReplace(attachment)}>替换</button><button type="button" aria-label={`移除附件 ${attachment.originalName}`} className="text-(--module-scope-feedback-danger)" onClick={() => void onRemove(attachment)}>×</button></span>;
}
function message(cause: unknown, fallback: string): string { return cause instanceof Error && cause.message ? cause.message : fallback; }

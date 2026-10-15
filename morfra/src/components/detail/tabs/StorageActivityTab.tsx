import { useState } from "react";
import type { ActivityEvent } from "../../../types/domain";
import { ConfirmDialog } from "../../shared/ConfirmDialog";

interface StorageActivityTabProps { events: ActivityEvent[]; loading: boolean; error: string | null; onUpdateNote: (eventId: string, note: string | null) => Promise<void>; onAddComment: (eventId: string, content: string) => Promise<void>; onDelete: (eventId: string) => Promise<void>; }

export function StorageActivityTab({ events, loading, error, onUpdateNote, onAddComment, onDelete }: StorageActivityTabProps) {
  const [target, setTarget] = useState<ActivityEvent | null>(null);
  if (loading) return <p className="text-[12px] text-(--module-scope-text-tertiary)">正在加载活动…</p>;
  if (error) return <p role="alert" className="text-[12px] text-(--module-scope-feedback-danger)">{error}</p>;
  if (events.length === 0) return <p className="text-[12px] text-(--module-scope-text-tertiary)">关联字段尚无变化记录。</p>;
  return <><ol className="m-0 space-y-3 p-0">{events.map((event, index) => <li key={event.id} className="list-none border-l-2 border-(--module-scope-border-strong) pl-3"><div className="flex items-start justify-between gap-2"><div><p className="m-0 text-[12px] font-medium">{event.fieldNameSnapshot}：{event.fromValueSnapshot ?? "空"} → {event.toValueSnapshot ?? "空"}{index === 0 && <span className="ml-1 text-[10px] text-(--module-scope-action-base)">最新</span>}</p><time className="text-[10px] text-(--module-scope-text-tertiary)">{event.occurredAt}</time></div><button type="button" className="text-[11px] text-(--module-scope-feedback-danger)" onClick={() => setTarget(event)}>删除</button></div>{event.note && <p className="mb-0 mt-1 text-[12px]">{event.note}</p>}<div className="mt-1 flex gap-2 text-[11px]"><button type="button" onClick={() => { const note = window.prompt("活动说明", event.note ?? ""); if (note !== null) void onUpdateNote(event.id, note || null); }}>说明</button><button type="button" onClick={() => { const content = window.prompt("添加评论"); if (content?.trim()) void onAddComment(event.id, content); }}>评论</button></div>{event.comments.map((comment) => <p key={comment.id} className="mb-0 mt-1 text-[11px] text-(--module-scope-text-secondary)">评论：{comment.content}</p>)}</li>)}</ol>{target && <ConfirmDialog title="删除活动节点？" body="该节点的说明和评论会一并删除，此操作不可撤销。" confirmLabel="删除节点" onCancel={() => setTarget(null)} onConfirm={() => { void onDelete(target.id); setTarget(null); }} />}</>;
}

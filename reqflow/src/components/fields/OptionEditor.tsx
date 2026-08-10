import { useState } from "react";
import type { FieldOptionSummary } from "../../types/domain";

interface OptionEditorProps {
  options: FieldOptionSummary[];
  onCreate: (name: string, color?: string) => Promise<void>;
  onUpdate: (option: FieldOptionSummary, name: string, color: string) => Promise<void>;
  onDelete: (option: FieldOptionSummary) => Promise<void>;
  onReorder: (optionIds: string[]) => Promise<void>;
}

export function OptionEditor({ options, onCreate, onUpdate, onDelete, onReorder }: OptionEditorProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("blue");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  async function create() { const name = newName.trim(); if (!name) return; await onCreate(name, newColor); setNewName(""); }
  async function update(option: FieldOptionSummary) { const name = editingName.trim(); if (!name) return; await onUpdate(option, name, editingColor); setEditingId(null); }
  async function move(option: FieldOptionSummary, delta: -1 | 1) { const index = options.findIndex((item) => item.id === option.id); const nextIndex = index + delta; if (index < 0 || nextIndex < 0 || nextIndex >= options.length) return; const next = [...options]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; await onReorder(next.map((item) => item.id)); }
  async function drop(option: FieldOptionSummary) { if (!draggedId || draggedId === option.id) return; const next = [...options]; const from = next.findIndex((item) => item.id === draggedId); const to = next.findIndex((item) => item.id === option.id); if (from < 0 || to < 0) return; const [item] = next.splice(from, 1); next.splice(to, 0, item); setDraggedId(null); await onReorder(next.map((item) => item.id)); }

  return <div className="border-t border-(--module-scope-border-subtle) pt-3"><div className="mb-2 text-[11px] font-medium text-(--module-scope-text-secondary)">选项</div><div className="space-y-1">
    {options.map((option, index) => editingId === option.id ? <div key={option.id} className="flex items-center gap-2"><input aria-label="选项名称" className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1 text-[11px]" value={editingName} onChange={(event) => setEditingName(event.target.value)} /><input aria-label="选项颜色" className="w-20 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1 text-[11px]" value={editingColor} onChange={(event) => setEditingColor(event.target.value)} /><button type="button" className="text-[11px] text-(--module-scope-action-base)" onClick={() => void update(option)}>保存</button></div> : <div key={option.id} draggable onDragStart={() => setDraggedId(option.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => void drop(option)} className="flex items-center gap-2 text-[11px]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{option.name}</span><button type="button" aria-label={`上移${option.name}`} disabled={index === 0} className="text-(--module-scope-text-tertiary) disabled:opacity-40" onClick={() => void move(option, -1)}>↑</button><button type="button" aria-label={`下移${option.name}`} disabled={index === options.length - 1} className="text-(--module-scope-text-tertiary) disabled:opacity-40" onClick={() => void move(option, 1)}>↓</button><button type="button" className="text-(--module-scope-text-tertiary)" onClick={() => { setEditingId(option.id); setEditingName(option.name); setEditingColor(option.color); }}>重命名</button><button type="button" className="text-(--module-scope-feedback-danger)" onClick={() => void onDelete(option)}>删除</button></div>)}
  </div><div className="mt-2 flex items-center gap-2"><input aria-label="新增选项" className="min-w-0 flex-1 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1 text-[11px]" placeholder="新增选项" value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void create(); }} /><input aria-label="新增选项颜色" className="w-20 rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) px-2 py-1 text-[11px]" value={newColor} onChange={(event) => setNewColor(event.target.value)} /><button type="button" className="rounded-(--r-sm) border border-(--module-scope-border-subtle) px-2 py-1 text-[11px]" onClick={() => void create()}>添加</button></div></div>;
}

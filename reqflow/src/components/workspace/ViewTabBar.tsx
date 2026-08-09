import { useEffect, useRef, useState, type DragEvent } from "react";
import type { ViewSummary } from "../../types/domain";
import { ConfirmDialog } from "../shared/ConfirmDialog";

interface ViewTabBarProps {
  tableId: string;
  views: ViewSummary[];
  activeViewId: string | null;
  onSelect: (viewId: string) => void;
  onCreate: (name: string, type: "table" | "board") => Promise<void>;
  onRename: (viewId: string, name: string) => Promise<void>;
  onDuplicate: (viewId: string, name: string) => Promise<void>;
  onDelete: (viewId: string) => Promise<void>;
  onReorder: (viewIds: string[]) => Promise<void>;
}

export function ViewTabBar({ tableId, views, activeViewId, onSelect, onCreate, onRename, onDuplicate, onDelete, onReorder }: ViewTabBarProps) {
  const [creating, setCreating] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"table" | "board">("table");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ViewSummary | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeViewId]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await onCreate(name, newType);
    setNewName("");
    setNewType("table");
    setCreating(false);
  }

  async function commitRename() {
    if (!editingId) return;
    const name = editingName.trim();
    if (name) await onRename(editingId, name);
    setEditingId(null);
  }

  function drop(event: DragEvent<HTMLButtonElement>, targetId: string) {
    event.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const ids = views.map((view) => view.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    setDraggedId(null);
    void onReorder(ids);
  }

  return <nav className="morfra-view-tabs" aria-label="当前表视图" data-table-id={tableId}>
    <div className="morfra-view-tabs-scroll">
      {views.map((view) => <div className="morfra-view-tab-wrap" key={view.id}>
        {editingId === view.id ? <input autoFocus aria-label={`重命名视图 ${view.name}`} value={editingName} onChange={(event) => setEditingName(event.target.value)} onBlur={() => void commitRename()} onKeyDown={(event) => { if (event.key === "Enter") void commitRename(); if (event.key === "Escape") setEditingId(null); }} className="morfra-view-tab-input" /> : <button ref={view.id === activeViewId ? activeRef : undefined} type="button" draggable onDragStart={() => setDraggedId(view.id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, view.id)} className={`morfra-view-tab ${view.id === activeViewId ? "is-active" : ""}`} aria-current={view.id === activeViewId ? "page" : undefined} onClick={() => { onSelect(view.id); setMenuId(null); }}><span aria-hidden="true">{view.viewType === "board" ? "▤" : "▦"}</span><span>{view.name}</span></button>}
        <button type="button" className="morfra-view-tab-menu" aria-label={`视图操作 ${view.name}`} aria-expanded={menuId === view.id} onClick={() => setMenuId(menuId === view.id ? null : view.id)}>⌄</button>
        {menuId === view.id && <div role="menu" className="morfra-view-menu">
          <button type="button" role="menuitem" onClick={() => { setEditingId(view.id); setEditingName(view.name); setMenuId(null); }}>重命名</button>
          <button type="button" role="menuitem" onClick={() => { void onDuplicate(view.id, `${view.name} 副本`); setMenuId(null); }}>复制视图</button>
          <button type="button" role="menuitem" disabled={views.length <= 1} onClick={() => { setDeleteTarget(view); setMenuId(null); }}>删除视图</button>
        </div>}
      </div>)}
    </div>
    <button type="button" className="morfra-view-add" aria-label="新建视图" onClick={() => { setCreating((value) => !value); setAllOpen(false); }}>＋</button>
    <button type="button" className="morfra-view-all" aria-label="所有视图" aria-expanded={allOpen} onClick={() => { setAllOpen((value) => !value); setCreating(false); }}>所有视图</button>
    {allOpen && <div role="menu" aria-label="所有视图菜单" className="morfra-all-views-menu">{views.map((view) => <button type="button" role="menuitem" key={view.id} onClick={() => { onSelect(view.id); setAllOpen(false); }}><span aria-hidden="true">{view.viewType === "board" ? "▤" : "▦"}</span>{view.name}</button>)}</div>}
    {creating && <form className="morfra-view-create" onSubmit={(event) => void create(event)}>
      <input autoFocus aria-label="新建视图名称" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="视图名称" />
      <select aria-label="视图类型" value={newType} onChange={(event) => setNewType(event.target.value as "table" | "board")}><option value="table">表格</option><option value="board">看板</option></select>
      <button type="submit">新建</button>
    </form>}
    {deleteTarget && <ConfirmDialog title={`删除“${deleteTarget.name}”？`} body="视图配置会被删除，底层表数据不会受影响。" confirmLabel="删除视图" onCancel={() => setDeleteTarget(null)} onConfirm={() => { void onDelete(deleteTarget.id).finally(() => setDeleteTarget(null)); }} />}
  </nav>;
}

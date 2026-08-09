import { useState, type DragEvent, type FormEvent } from "react";
import type { TableSummary } from "../../types/domain";
import { ConfirmDialog } from "../shared/ConfirmDialog";

interface TableListProps {
  tables: TableSummary[];
  activeTableId: string | null;
  canUndo: boolean;
  onSelect: (tableId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (tableId: string, name: string) => Promise<void>;
  onDelete: (tableId: string) => Promise<void>;
  onReorder: (tableIds: string[]) => Promise<void>;
  onUndo: () => Promise<void>;
}

export function TableList({ tables, activeTableId, canUndo, onSelect, onCreate, onRename, onDelete, onReorder, onUndo }: TableListProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TableSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      setError(null);
      await onCreate(name);
      setNewName("");
      setCreating(false);
    } catch {
      setError("新建表失败，请重试");
    }
  }

  async function commitRename() {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    try {
      setError(null);
      await onRename(renamingId, name);
      setRenamingId(null);
    } catch {
      setError("表重命名失败，请重试");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setError(null);
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setError(tables.length <= 1 ? "至少保留一张表" : "删除表失败，数据未被修改");
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>, targetId: string) {
    event.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const next = tables.map((table) => table.id);
    const from = next.indexOf(draggedId);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, draggedId);
    setDraggedId(null);
    void onReorder(next).catch(() => setError("表顺序保存失败，请重试"));
  }

  return (
    <section className="morfra-sidebar-section morfra-table-list" aria-label="当前项目的表">
      <div className="morfra-sidebar-list-heading">
        <span className="morfra-sidebar-label">当前项目</span>
        <button type="button" className="morfra-sidebar-add" aria-label="新建表" onClick={() => setCreating((value) => !value)}>＋</button>
      </div>
      {creating && <form className="morfra-sidebar-inline-form" onSubmit={(event) => void handleCreate(event)}>
        <input autoFocus aria-label="新建表名称" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="未命名表" />
      </form>}
      <div className="morfra-table-list-scroll">
        {tables.map((table) => <div key={table.id} className="morfra-table-row">
          {renamingId === table.id ? <input autoFocus aria-label={`重命名表 ${table.name}`} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={() => void commitRename()} onKeyDown={(event) => { if (event.key === "Enter") void commitRename(); if (event.key === "Escape") setRenamingId(null); }} className="morfra-table-rename-input" /> : <button type="button" draggable onDragStart={() => setDraggedId(table.id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, table.id)} className={`morfra-table-item ${table.id === activeTableId ? "is-active" : ""}`} aria-current={table.id === activeTableId ? "page" : undefined} onClick={() => onSelect(table.id)}><span className="morfra-table-icon">▦</span><span className="morfra-project-name">{table.name}</span><span className="morfra-table-count">{table.recordCount}</span></button>}
          <button type="button" className="morfra-table-more" aria-label={`更多表操作 ${table.name}`} aria-expanded={menuId === table.id} onClick={() => setMenuId(menuId === table.id ? null : table.id)}>⋯</button>
          {menuId === table.id && <div role="menu" className="morfra-table-actions-menu"><button type="button" role="menuitem" onClick={() => { setRenamingId(table.id); setRenameValue(table.name); setMenuId(null); }}>重命名</button><button type="button" role="menuitem" onClick={() => { setDeleteTarget(table); setMenuId(null); }}>删除</button></div>}
        </div>)}
        {tables.length === 0 && <p className="morfra-sidebar-empty">没有打开的表</p>}
      </div>
      {canUndo && <button type="button" className="morfra-sidebar-undo" onClick={() => void onUndo().catch(() => setError("当前会话没有可撤销的存储操作"))}>撤销上次表操作</button>}
      {error && <p className="morfra-sidebar-error" role="alert">{error}</p>}
      {deleteTarget && <ConfirmDialog title={`删除“${deleteTarget.name}”？`} body="这会删除表、字段、记录、视图及附件。删除后可在当前会话内撤销。" confirmLabel="删除表" onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />}
    </section>
  );
}

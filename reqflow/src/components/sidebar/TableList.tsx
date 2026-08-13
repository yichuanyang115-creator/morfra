import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import type { TableSummary } from "../../types/domain";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { TableActionsMenu, type OpenTableMenu } from "./TableActionsMenu";
import { recordRecentTableEmoji } from "../../lib/tableEmojiPreferences";
import { TableIcon } from "./TableIcon";

interface Props {
  tables: TableSummary[];
  activeTableId: string | null;
  compact?: boolean;
  createRequest?: number;
  onSelect: (tableId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (tableId: string, name: string) => Promise<void>;
  onEmojiChange: (tableId: string, emoji: string) => Promise<void>;
  onDelete: (tableId: string) => Promise<void>;
  onReorder: (tableIds: string[]) => Promise<void>;
}

export function TableList({ tables, activeTableId, compact = false, createRequest = 0, onSelect, onCreate, onRename, onEmojiChange, onDelete, onReorder }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [openMenu, setOpenMenu] = useState<OpenTableMenu | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TableSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const handledCreateRequest = useRef(0);
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const createTriggerRef = useRef<HTMLElement | null>(null);
  const submittingCreate = useRef(false);
  const cancelingCreate = useRef(false);

  useEffect(() => {
    if (!compact && createRequest > handledCreateRequest.current) {
      handledCreateRequest.current = createRequest;
      createTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      cancelingCreate.current = false;
      setError(null);
      setCreating(true);
    }
  }, [compact, createRequest]);

  useEffect(() => {
    if (!creating) return;
    const input = createInputRef.current;
    input?.scrollIntoView?.({ block: "nearest" });
    input?.focus();
  }, [creating]);

  function cancelCreate(restoreFocus = false) {
    cancelingCreate.current = true;
    setCreating(false);
    setNewName("");
    setError(null);
    if (restoreFocus) requestAnimationFrame(() => createTriggerRef.current?.focus());
  }

  async function submitCreate() {
    if (submittingCreate.current) return;
    const name = newName.trim();
    if (!name) return;
    try {
      submittingCreate.current = true;
      setIsSubmittingCreate(true);
      setError(null);
      await onCreate(name);
      setNewName("");
      setCreating(false);
    } catch {
      setError("新建表失败，请重试");
      requestAnimationFrame(() => createInputRef.current?.focus());
    } finally {
      submittingCreate.current = false;
      setIsSubmittingCreate(false);
    }
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCreate();
  }

  function handleCreateBlur() {
    if (cancelingCreate.current) {
      cancelingCreate.current = false;
      return;
    }
    if (!newName.trim()) {
      cancelCreate();
      return;
    }
    void submitCreate();
  }

  async function commitRename() {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (!name) return setRenamingId(null);
    try {
      setError(null);
      await onRename(renamingId, name);
      setRenamingId(null);
    } catch {
      setError("表重命名失败，请重试");
    }
  }

  async function changeEmoji(tableId: string, emoji: string) {
    try {
      setError(null);
      await onEmojiChange(tableId, emoji);
      recordRecentTableEmoji(emoji);
      closeMenu(true);
    } catch {
      setError("表 Emoji 保存失败，原 Emoji 未修改");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setError(null);
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } catch (caught) {
      setError(tables.length <= 1 ? "至少保留一张表" : caught instanceof Error && caught.message ? caught.message : "删除表失败，请重试");
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

  function closeMenu(restoreFocus: boolean) {
    const anchor = openMenu?.anchor;
    setOpenMenu(null);
    if (restoreFocus) requestAnimationFrame(() => anchor?.focus());
  }

  return <section className={`morfra-sidebar-section morfra-table-list${compact ? " is-compact" : ""}`} aria-label="当前项目的表">
    <div className="morfra-table-list-scroll">
      {tables.map((table) => <div key={table.id} className="morfra-table-row">
        {!compact && renamingId === table.id ? <input autoFocus aria-label={`重命名表 ${table.name}`} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={() => void commitRename()} onKeyDown={(event) => { if (event.key === "Enter") void commitRename(); if (event.key === "Escape") setRenamingId(null); }} className="morfra-table-rename-input" /> : <button type="button" draggable={!compact} title={compact ? table.name : undefined} aria-label={compact ? table.name : undefined} onDragStart={() => !compact && setDraggedId(table.id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => !compact && event.preventDefault()} onDrop={(event) => !compact && handleDrop(event, table.id)} className={`morfra-table-item${table.id === activeTableId ? " is-active" : ""}`} aria-current={table.id === activeTableId ? "page" : undefined} onClick={() => onSelect(table.id)}><TableIcon emoji={table.emoji} className="morfra-table-icon" />{!compact && <><span className="morfra-project-name">{table.name}</span><span className="morfra-table-count">{table.recordCount}</span></>}</button>}
        {!compact && <button type="button" className="morfra-table-more" aria-label={`更多表操作 ${table.name}`} aria-haspopup="menu" aria-expanded={openMenu?.table.id === table.id} onClick={(event) => openMenu?.table.id === table.id ? closeMenu(true) : setOpenMenu({ table, anchor: event.currentTarget })} onKeyDown={(event) => { if (["ArrowDown", "Enter", " "].includes(event.key) && openMenu?.table.id !== table.id) { event.preventDefault(); setOpenMenu({ table, anchor: event.currentTarget }); } }}>⋯</button>}
      </div>)}
      {!compact && creating && <form className="morfra-sidebar-inline-form" onSubmit={handleCreateSubmit}>
        <input ref={createInputRef} aria-label="新表名称" aria-describedby={error ? "morfra-new-table-error" : undefined} value={newName} onChange={(event) => setNewName(event.target.value)} onBlur={handleCreateBlur} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancelCreate(true); } }} placeholder="未命名表" disabled={isSubmittingCreate} />
      </form>}
      {!tables.length && !compact && !creating && <p className="morfra-sidebar-empty">没有打开的表</p>}
    </div>
    {!compact && error && <p id="morfra-new-table-error" className="morfra-sidebar-error" role="alert">{error}</p>}
    {deleteTarget && <ConfirmDialog title={`删除“${deleteTarget.name}”？`} body="这会删除表、字段、记录、视图及附件。删除后可在当前会话内撤销。" confirmLabel="删除表" onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />}
    {openMenu && <TableActionsMenu openMenu={openMenu} onClose={closeMenu} onRename={() => { setRenamingId(openMenu.table.id); setRenameValue(openMenu.table.name); closeMenu(false); }} onEmojiChange={(emoji) => void changeEmoji(openMenu.table.id, emoji)} onDelete={() => { setDeleteTarget(openMenu.table); closeMenu(false); }} />}
  </section>;
}

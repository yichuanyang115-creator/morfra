import { useState } from "react";
import type { TableSummary } from "../../types/domain";

interface TableHeaderProps {
  table: TableSummary;
  onRename: (name: string) => Promise<void>;
  onOpenFieldManager?: () => void;
}

export function TableHeader({ table, onRename, onOpenFieldManager }: TableHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(table.name);

  async function commit() {
    const nextName = name.trim();
    if (nextName && nextName !== table.name) await onRename(nextName);
    setEditing(false);
  }

  return <header className="morfra-table-header">
    <div className="morfra-table-header-main">
      <span className="morfra-table-header-kicker">表</span>
      {editing ? <input autoFocus aria-label="表名称" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => void commit()} onKeyDown={(event) => { if (event.key === "Enter") void commit(); if (event.key === "Escape") { setName(table.name); setEditing(false); } }} className="morfra-table-title-input" /> : <button type="button" className="morfra-table-title-button" onClick={() => { setName(table.name); setEditing(true); }}>{table.name}</button>}
    </div>
    <div className="flex items-center gap-2"><span className="morfra-table-record-count">{table.recordCount} 条记录</span>{onOpenFieldManager && <button type="button" className="rounded-(--r-sm) border border-(--module-scope-border-subtle) px-2 py-1 text-[11px] text-(--module-scope-text-secondary)" onClick={onOpenFieldManager}>字段管理</button>}</div>
  </header>;
}

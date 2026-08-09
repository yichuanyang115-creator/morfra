import { useState } from "react";
import { open as openDirectoryDialog } from "@tauri-apps/plugin-dialog";
import { currentProject, useProjectStore } from "../../stores/projectStore";

interface ProjectSwitcherProps {
  onProjectSelected?: () => void;
  closeOnClick?: boolean;
}

export function ProjectSwitcher({ onProjectSelected, closeOnClick = false }: ProjectSwitcherProps) {
  const project = useProjectStore(currentProject);
  const projects = useProjectStore((state) => state.projects);
  const switchProject = useProjectStore((state) => state.switchProject);
  const openProject = useProjectStore((state) => state.openProject);
  const createProject = useProjectStore((state) => state.createProject);
  const renameProject = useProjectStore((state) => state.renameProject);
  const removeRecentProject = useProjectStore((state) => state.removeRecentProject);
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleOpenLocalProject() {
    let selected: string | string[] | null;
    try {
      selected = await openDirectoryDialog({ directory: true, multiple: false, title: "打开 Morfra 项目" });
    } catch {
      setError("当前运行环境不支持打开本地项目");
      return;
    }
    if (typeof selected !== "string") return;
    try {
      setError(null);
      await openProject(selected);
      setExpanded(false);
      onProjectSelected?.();
    } catch {
      setError("项目打开失败，请选择包含 project.json 和 morfra.sqlite3 的项目文件夹");
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    try {
      setError(null);
      await createProject(nextName);
      setName("");
      setExpanded(false);
      onProjectSelected?.();
    } catch {
      setError("项目创建失败，请重试");
    }
  }

  async function handleSwitch(id: string) {
    try {
      setError(null);
      await switchProject(id);
      setExpanded(false);
      onProjectSelected?.();
    } catch {
      setError("项目打开失败，请检查项目包完整性");
    }
  }

  async function commitRename() {
    if (!renamingId) return;
    const nextName = renameValue.trim();
    if (nextName) {
      try { await renameProject(renamingId, nextName); } catch { setError("项目重命名失败，请重试"); }
    }
    setRenamingId(null);
  }

  return (
    <div className="relative min-w-0" data-testid="project-switcher">
      <button type="button" className="flex w-full items-center justify-between gap-2 rounded-(--r-sm) border-0 bg-transparent px-2 py-1.5 text-left text-[13px] font-[590] text-(--module-scope-text-primary) hover:bg-(--module-scope-action-soft)" aria-haspopup="menu" aria-expanded={expanded} onClick={() => { if (closeOnClick) { onProjectSelected?.(); return; } setExpanded((value) => !value); }}>
        <span className="min-w-0 truncate">{project?.name ?? "没有打开的项目"}</span><span aria-hidden="true" className="text-(--module-scope-text-tertiary)">⌄</span>
      </button>
      {expanded && <div role="menu" aria-label="最近项目" className="absolute left-0 top-full z-50 mt-1 w-72 rounded-(--r-md) border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) p-1.5 shadow-(--shadow-floating)">
        <div className="px-2 py-1 text-[11px] text-(--module-scope-text-tertiary)">最近打开</div>
        {projects.map((item) => <div key={item.id} className="group flex items-center gap-1 rounded-(--r-sm) px-2 py-1.5 text-[12px] hover:bg-(--module-scope-action-soft)">
          {renamingId === item.id ? <input autoFocus aria-label="项目名称" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={() => void commitRename()} onKeyDown={(event) => { if (event.key === "Enter") void commitRename(); if (event.key === "Escape") setRenamingId(null); }} className="min-w-0 flex-1 rounded border border-(--module-scope-action-base) bg-transparent px-1 py-0.5 outline-none" /> : <button type="button" role="menuitem" className={`min-w-0 flex-1 truncate border-0 bg-transparent px-0 text-left ${item.id === project?.id ? "font-[590] text-(--module-scope-action-strong)" : "text-(--module-scope-text-primary)"}`} onClick={() => void handleSwitch(item.id)}>{item.name}</button>}
          {renamingId !== item.id && <button type="button" aria-label={`重命名项目 ${item.name}`} className="hidden border-0 bg-transparent px-1 text-(--module-scope-text-tertiary) group-hover:inline" onClick={() => { setRenamingId(item.id); setRenameValue(item.name); }}>✎</button>}
          {renamingId !== item.id && <button type="button" aria-label={`从最近项目中移除 ${item.name}`} className="hidden border-0 bg-transparent px-1 text-(--module-scope-text-tertiary) group-hover:inline" onClick={() => void removeRecentProject(item.id)}>×</button>}
        </div>)}
        <div className="my-1 border-t border-(--module-scope-border-subtle)" />
        <form onSubmit={(event) => void handleCreate(event)} className="flex gap-1 px-1 py-1">
          <input aria-label="新建项目名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="新建空白项目" className="min-w-0 flex-1 rounded border border-(--module-scope-border-subtle) bg-transparent px-2 py-1 text-[12px] outline-none focus:border-(--module-scope-action-base)" />
          <button type="submit" className="rounded bg-(--module-scope-action-strong) px-2 py-1 text-[12px] text-(--module-scope-background-surface)">新建</button>
        </form>
        <button type="button" role="menuitem" className="w-full rounded-(--r-sm) px-2 py-1.5 text-left text-[12px] text-(--module-scope-text-primary) hover:bg-(--module-scope-action-soft)" onClick={() => void handleOpenLocalProject()}>打开本地项目…</button>
        {error && <p role="alert" className="m-1 px-1 text-[11px] text-(--module-scope-feedback-danger)">{error}</p>}
      </div>}
    </div>
  );
}

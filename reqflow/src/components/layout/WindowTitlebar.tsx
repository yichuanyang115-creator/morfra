import { useState } from "react";
import { open as openDirectoryDialog } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../../stores/projectStore";
import type { AppearanceMode } from "../../stores/layoutStore";

interface WindowTitlebarProps {
  projectName: string | null;
  sidebarOpen: boolean;
  aiOpen: boolean;
  appearanceMode: AppearanceMode;
  onToggleSidebar: () => void;
  onToggleAi: () => void;
  onCycleAppearance: () => void;
}

function SidebarIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3.5 4.5h13v11h-13zM8 4.5v11" stroke="currentColor" strokeWidth="1.4" /></svg>;
}

function SparkIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m10 2 1.55 5.1L16.5 9l-4.95 1.9L10 16l-1.55-5.1L3.5 9l4.95-1.9L10 2Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" /></svg>;
}

function AppearanceIcon({ mode }: { mode: AppearanceMode }) {
  return <span aria-hidden="true" className="morfra-appearance-glyph">{mode === "dark" ? "☾" : mode === "light" ? "☀" : "◐"}</span>;
}

function FileMenu() {
  const createProject = useProjectStore((state) => state.createProject);
  const openProject = useProjectStore((state) => state.openProject);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    try {
      setError(null);
      await createProject(nextName);
      setName("");
      setOpen(false);
    } catch {
      setError("项目创建失败，请重试");
    }
  }

  async function openLocal() {
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
      setOpen(false);
    } catch {
      setError("项目打开失败，请检查项目文件夹");
    }
  }

  return <div className="morfra-file-menu">
    <button type="button" className={`morfra-file-menu-trigger ${open ? "is-active" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>文件</button>
    {open && <div role="menu" aria-label="文件菜单" className="morfra-file-menu-popover">
      <form onSubmit={(event) => void create(event)} className="morfra-file-menu-create"><label htmlFor="titlebar-new-project">新建空白项目</label><div><input id="titlebar-new-project" aria-label="新建项目名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="项目名称" /><button type="submit">新建</button></div></form>
      <button type="button" role="menuitem" onClick={() => void openLocal()}>打开本地项目…</button>
      {error && <p role="alert">{error}</p>}
    </div>}
  </div>;
}

export function WindowTitlebar({ projectName, sidebarOpen, aiOpen, appearanceMode, onToggleSidebar, onToggleAi, onCycleAppearance }: WindowTitlebarProps) {
  const appearanceLabel = appearanceMode === "system" ? "跟随系统" : appearanceMode === "light" ? "浅色" : "深色";
  return (
    <header className="morfra-titlebar" data-testid="morfra-titlebar">
      <button type="button" className="morfra-titlebar-button" aria-label={sidebarOpen ? "收起导航" : "展开导航"} onClick={onToggleSidebar}>
        <SidebarIcon />
      </button>
      <div className="morfra-wordmark" data-tauri-drag-region>
        <span className="morfra-wordmark-name">morfra</span>
        <span className="morfra-titlebar-project">{projectName ?? "没有打开的项目"}</span>
      </div>
      <FileMenu />
      <div className="morfra-titlebar-actions">
        <button type="button" className={`morfra-titlebar-button ${aiOpen ? "is-active" : ""}`} aria-label={aiOpen ? "关闭 AI 表格助手" : "打开 AI 表格助手"} aria-pressed={aiOpen} onClick={onToggleAi}>
          <SparkIcon />
        </button>
        <button type="button" className="morfra-titlebar-button" aria-label={`切换外观，当前为${appearanceLabel}`} onClick={onCycleAppearance}>
          <AppearanceIcon mode={appearanceMode} />
        </button>
      </div>
    </header>
  );
}

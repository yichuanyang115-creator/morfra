import { ProjectSwitcher } from "../sidebar/ProjectSwitcher";
import { NewTableIcon } from "../sidebar/TableIcon";

interface WindowTitlebarProps {
  sidebarOpen: boolean;
  aiOpen: boolean;
  aiCompleted?: boolean;
  onToggleSidebar: () => void;
  onCreateTable: () => void;
  onToggleAi: () => void;
}

function SidebarIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3.5 4.5h13v11h-13zM8 4.5v11" stroke="currentColor" strokeWidth="1.4" /></svg>;
}

function SparkIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m10 2 1.55 5.1L16.5 9l-4.95 1.9L10 16l-1.55-5.1L3.5 9l4.95-1.9L10 2Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" /></svg>;
}

export function WindowTitlebar({ sidebarOpen, aiOpen, aiCompleted = false, onToggleSidebar, onCreateTable, onToggleAi }: WindowTitlebarProps) {
  return (
    <header className="morfra-titlebar" data-testid="morfra-titlebar">
      <button type="button" className="morfra-titlebar-button" aria-label={sidebarOpen ? "收起导航" : "展开导航"} onClick={onToggleSidebar}>
        <SidebarIcon />
      </button>
      <button type="button" className="morfra-titlebar-button" aria-label="新建表" title="新建表" onClick={onCreateTable}><NewTableIcon /></button>
      <div className="morfra-titlebar-project-context"><ProjectSwitcher /></div>
      <div className="morfra-titlebar-drag-region" data-tauri-drag-region />
      <div className="morfra-titlebar-actions">
        <button type="button" className={`morfra-titlebar-button relative ${aiOpen ? "is-active" : ""}`} aria-label={aiOpen ? "关闭 AI 表格助手" : "打开 AI 表格助手"} aria-pressed={aiOpen} onClick={onToggleAi}>
          <SparkIcon />
          {aiCompleted && !aiOpen && <span role="status" aria-label="AI 已完成" className="absolute right-0 top-0 size-1.5 rounded-full bg-(--module-scope-feedback-success)" />}
        </button>
      </div>
    </header>
  );
}

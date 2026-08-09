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

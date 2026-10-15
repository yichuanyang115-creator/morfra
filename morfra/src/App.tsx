import { useEffect } from "react";
import { useProjectStore } from "./stores/projectStore";
import { useThemeStore } from "./stores/themeStore";
import { StorageWorkspace } from "./components/storage/StorageWorkspace";
import { MorfraShell } from "./components/layout/MorfraShell";
import { Toast } from "./components/shared/Toast";

function App() {
  const initProjects = useProjectStore((s) => s.init);
  const loadTheme = useThemeStore((s) => s.load);
  const themeLoaded = useThemeStore((s) => s.loaded);
  const themeRecoveryNotice = useThemeStore((s) => s.recoveryNotice);
  const acknowledgeThemeRecovery = useThemeStore((s) => s.acknowledgeRecovery);
  const projectsLoaded = useProjectStore((s) => s.loaded);
  const projectsError = useProjectStore((s) => s.error);

  useEffect(() => {
    void loadTheme();
  }, [loadTheme]);

  useEffect(() => {
    void initProjects();
  }, [initProjects]);

  const storageContent = !themeLoaded ? (
      <div className="flex h-full items-center justify-center text-(--module-scope-text-secondary) text-[13px]">加载外观…</div>
    ) : projectsError ? (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-(--module-scope-text-secondary) text-[13px]">
        <span>项目数据读取失败，请检查应用数据目录</span>
        <button type="button" onClick={() => void initProjects()} className="rounded border border-(--module-scope-border-subtle) px-2.5 py-1.5 text-[12px]">重试</button>
      </div>
    ) : !projectsLoaded ? (
      <div className="flex h-full items-center justify-center text-(--module-scope-text-secondary) text-[13px]">加载项目…</div>
    ) : <StorageWorkspace embedded />;

  const storageMainContent = <>{storageContent}{themeRecoveryNotice && <Toast message={themeRecoveryNotice} tone="danger" onDismiss={acknowledgeThemeRecovery} />}</>;

  return <MorfraShell mainContent={storageMainContent} />;
}

export default App;

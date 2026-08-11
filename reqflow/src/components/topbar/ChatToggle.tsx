import { useEffect, useRef, useState } from "react";
import { findLegacyChatPreferenceMigration } from "../../adapters/ai/legacyChatPreferenceMigrationHost";
import { useAIProviderStore } from "../../stores/aiProviderStore";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";

function ChatIcon() {
  return <svg className="icon-sm" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 4.5h14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8l-3.5 3v-3H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>;
}

export function ChatToggle() {
  const open = useAIProviderStore((state) => state.panelOpen);
  const loaded = useAIProviderStore((state) => state.loaded);
  const load = useAIProviderStore((state) => state.load);
  const setPanelOpen = useAIProviderStore((state) => state.setPanelOpen);
  const setPanelWidth = useAIProviderStore((state) => state.setPanelWidth);
  const openAppSettings = useUiStore((state) => state.openAppSettings);
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const migrationAttempted = useRef(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (loaded || migrationAttempted.current) return;
    migrationAttempted.current = true;
    let cancelled = false;
    void (async () => {
      const candidate = currentProjectId ? await findLegacyChatPreferenceMigration(currentProjectId).catch(() => null) : null;
      if (candidate?.open !== undefined) await setPanelOpen(candidate.open);
      if (candidate?.width !== undefined) await setPanelWidth(candidate.width);
      if (!cancelled) await load();
    })();
    return () => { cancelled = true; };
  }, [currentProjectId, load, loaded, setPanelOpen, setPanelWidth]);

  useEffect(() => {
    const handleCompleted = () => setCompleted(true);
    const handleSettings = () => openAppSettings("ai-service");
    window.addEventListener("ai-generation-completed", handleCompleted);
    window.addEventListener("open-ai-service-settings", handleSettings);
    return () => {
      window.removeEventListener("ai-generation-completed", handleCompleted);
      window.removeEventListener("open-ai-service-settings", handleSettings);
    };
  }, [openAppSettings]);

  return <button type="button" aria-label={open ? "关闭 AI 面板" : "打开 AI 面板"} aria-pressed={open} onClick={() => { setCompleted(false); void setPanelOpen(!open); }} className={`relative grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none text-(--module-scope-text-secondary) ${open ? "bg-(--module-scope-context-soft) text-(--module-scope-context-strong)" : "bg-transparent hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)"}`}>
    <ChatIcon />
    {completed && !open && <span role="status" aria-label="AI 已完成" className="absolute right-0 top-0 size-1.5 rounded-full bg-(--module-scope-feedback-success)" />}
  </button>;
}

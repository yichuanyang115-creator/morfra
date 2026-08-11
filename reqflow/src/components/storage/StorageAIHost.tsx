import { useEffect, useMemo, useRef } from "react";
import { createCurrentStorageHostActions, createCurrentStorageTableAdapter, type CurrentStorageHostActions, type CurrentStorageTableAdapter } from "../../adapters/ai/currentStorageTableAdapter";
import { findLegacyChatPreferenceMigration } from "../../adapters/ai/legacyChatPreferenceMigrationHost";
import { ChatPanel } from "../chat/ChatPanel";
import { deleteTableAIDataAndVerify } from "../../lib/ai/integrationChecks";
import { onBeforeTableDeleted } from "../../lib/tableLifecycleEvents";
import { useAIProviderStore } from "../../stores/aiProviderStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { currentProject, useProjectStore } from "../../stores/projectStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";

function createHostActions(showRecordDetail: () => void): CurrentStorageHostActions {
  return createCurrentStorageHostActions(undefined, showRecordDetail);
}

/** 生产 StorageWorkspace 的可替换 AI 宿主：只在 adapter 层读取 Zustand，不反向扩展 AI Core。 */
export function StorageAIHost({ onClose }: { onClose: () => void }) {
  const adapterRef = useRef<CurrentStorageTableAdapter | null>(null);
  if (!adapterRef.current) adapterRef.current = createCurrentStorageTableAdapter();
  const adapter = adapterRef.current;
  const project = useProjectStore(currentProject);
  const activeTableByProject = useWorkspaceStore((state) => state.activeTableByProject);
  const setActiveRightPanel = useLayoutStore((state) => state.setActiveRightPanel);
  const detailOpen = useLayoutStore((state) => state.detailOpen);
  const toggleDetail = useLayoutStore((state) => state.toggleDetail);

  useEffect(() => () => adapter.dispose(), [adapter]);
  const activeTableId = project ? activeTableByProject[project.id] : undefined;
  const table = useMemo(() => adapter.getActiveTable(), [adapter, project?.id, activeTableId]);
  const hostActions = useMemo(() => createHostActions(() => {
    setActiveRightPanel("detail");
    if (!detailOpen) toggleDetail();
  }), [detailOpen, setActiveRightPanel, toggleDetail]);

  if (!table) return <div className="morfra-context-empty morfra-ai-empty"><span className="morfra-empty-symbol">✦</span><p>AI 表格助手</p><span>打开包含表格的本地项目后即可分析。</span></div>;
  return <ChatPanel width={1} fillContainer tableContext={{ table, adapter }} hostActions={hostActions} onClose={onClose} />;
}

/** 始终挂在生产外壳内，确保 AI 面板关闭时删表也会精确清理独立会话目录。 */
export function StorageAICascade() {
  useEffect(() => onBeforeTableDeleted(async (tableId) => {
    await deleteTableAIDataAndVerify(tableId);
  }), []);
  return null;
}

/** 将旧 Markdown 工作区的 open/width 一次性映射到生产 Morfra 的 AI 偏好与右栏布局。 */
export function StorageAIPreferenceMigration() {
  const projectId = useProjectStore((state) => state.currentProjectId);
  const attemptedProjectIds = useRef(new Set<string>());

  useEffect(() => {
    if (!projectId || attemptedProjectIds.current.has(projectId)) return;
    attemptedProjectIds.current.add(projectId);
    let cancelled = false;
    void (async () => {
      const candidate = await findLegacyChatPreferenceMigration(projectId).catch(() => null);
      if (!candidate || cancelled) return;
      const provider = useAIProviderStore.getState();
      if (!provider.loaded) await provider.load();
      if (candidate.open !== undefined) await useAIProviderStore.getState().setPanelOpen(candidate.open);
      if (candidate.width !== undefined) await useAIProviderStore.getState().setPanelWidth(candidate.width);
      if (cancelled) return;
      const layout = useLayoutStore.getState();
      if (candidate.open !== undefined) layout.setAiOpen(candidate.open);
      if (candidate.width !== undefined) layout.setAiWidth(candidate.width);
      if (candidate.open) layout.setActiveRightPanel("ai");
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  return null;
}

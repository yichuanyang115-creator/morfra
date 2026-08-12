import { useEffect, useMemo, useRef } from "react";
import { createCurrentStorageHostActions, createCurrentStorageTableAdapter, type CurrentStorageHostActions, type CurrentStorageTableAdapter } from "../../adapters/ai/currentStorageTableAdapter";
import { ChatPanel } from "../chat/ChatPanel";
import { prepareTableAIDataDeletion } from "../../lib/ai/integrationChecks";
import { onBeforeTableDeleted } from "../../lib/tableLifecycleEvents";
import { useLayoutStore } from "../../stores/layoutStore";
import { currentProject, useProjectStore } from "../../stores/projectStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";

function createHostActions(showRecordDetail: () => void): CurrentStorageHostActions {
  return createCurrentStorageHostActions(undefined, showRecordDetail);
}

/** 生产 StorageWorkspace 的可替换 AI 宿主：只在 adapter 层读取 Zustand，不反向扩展 AI Core。 */
export function StorageAIHost() {
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
  return <ChatPanel width={1} fillContainer tableContext={{ table, adapter }} hostActions={hostActions} />;
}

/** 始终挂在生产外壳内，确保 AI 面板关闭时删表也会精确清理独立会话目录。 */
export function StorageAICascade() {
  useEffect(() => onBeforeTableDeleted(async (tableId) => {
    return prepareTableAIDataDeletion(tableId);
  }), []);
  return null;
}

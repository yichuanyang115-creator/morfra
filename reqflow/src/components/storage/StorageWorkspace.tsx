import { useEffect, useMemo, useState } from "react";
import { currentProject, useProjectStore } from "../../stores/projectStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { ProjectSwitcher } from "../sidebar/ProjectSwitcher";
import { TableList } from "../sidebar/TableList";
import { TableHeader } from "../workspace/TableHeader";
import { ViewTabBar } from "../workspace/ViewTabBar";
import { ViewToolbar } from "../workspace/ViewToolbar";

interface StorageWorkspaceProps {
  embedded?: boolean;
}

export function StorageWorkspace({ embedded = false }: StorageWorkspaceProps = {}) {
  const project = useProjectStore(currentProject);
  const canUndo = useProjectStore((state) => state.canUndo);
  const createTable = useProjectStore((state) => state.createTable);
  const renameTable = useProjectStore((state) => state.renameTable);
  const deleteTable = useProjectStore((state) => state.deleteTable);
  const reorderTables = useProjectStore((state) => state.reorderTables);
  const createView = useProjectStore((state) => state.createView);
  const renameView = useProjectStore((state) => state.renameView);
  const duplicateView = useProjectStore((state) => state.duplicateView);
  const deleteView = useProjectStore((state) => state.deleteView);
  const reorderViews = useProjectStore((state) => state.reorderViews);
  const undoStorageChange = useProjectStore((state) => state.undoStorageChange);
  const closeProject = useProjectStore((state) => state.closeProject);
  const activeTableByProject = useWorkspaceStore((state) => state.activeTableByProject);
  const activeViewByTable = useWorkspaceStore((state) => state.activeViewByTable);
  const setActiveTable = useWorkspaceStore((state) => state.setActiveTable);
  const setActiveView = useWorkspaceStore((state) => state.setActiveView);
  const [error, setError] = useState<string | null>(null);

  const tables = project?.storageSnapshot?.tables ?? [];
  const activeTableId = project ? activeTableByProject[project.id] ?? tables[0]?.id ?? null : null;
  const activeTable = tables.find((table) => table.id === activeTableId) ?? tables[0] ?? null;
  const activeViewId = activeTable ? activeViewByTable[activeTable.id] ?? activeTable.views[0]?.id ?? null : null;
  const activeView = activeTable?.views.find((view) => view.id === activeViewId) ?? activeTable?.views[0] ?? null;

  useEffect(() => {
    if (!project || !activeTable) return;
    if (activeTableByProject[project.id] !== activeTable.id) setActiveTable(project.id, activeTable.id);
    const firstView = activeTable.views[0];
    if (firstView && activeViewByTable[activeTable.id] !== firstView.id && !activeTable.views.some((view) => view.id === activeViewByTable[activeTable.id])) setActiveView(activeTable.id, firstView.id);
  }, [activeTable, activeTableByProject, activeViewByTable, project, setActiveTable, setActiveView]);

  const actions = useMemo(() => ({
    async createTable(name: string) { await createTable(name); },
    async renameTable(id: string, name: string) { await renameTable(id, name); },
    async deleteTable(id: string) { await deleteTable(id); },
    async reorderTables(ids: string[]) { await reorderTables(ids); },
    async createView(tableId: string, name: string, type: "table" | "board") { await createView(tableId, name, type); },
    async renameView(id: string, name: string) { await renameView(id, name); },
    async duplicateView(id: string, name: string) { await duplicateView(id, name); },
    async deleteView(id: string) { await deleteView(id); },
    async reorderViews(tableId: string, ids: string[]) { await reorderViews(tableId, ids); },
  }), [createTable, createView, deleteTable, deleteView, duplicateView, renameTable, renameView, reorderTables, reorderViews]);

  async function run(action: () => Promise<void>, message: string) {
    try {
      setError(null);
      await action();
    } catch {
      setError(message);
    }
  }

  const tableList = project && <TableList tables={tables} activeTableId={activeTable?.id ?? null} canUndo={canUndo} onSelect={(id) => project && setActiveTable(project.id, id)} onCreate={(name) => run(() => actions.createTable(name), "新建表失败，请重试")} onRename={(id, name) => run(() => actions.renameTable(id, name), "表重命名失败，请重试")} onDelete={(id) => run(() => actions.deleteTable(id), "删除表失败，数据未被修改")} onReorder={(ids) => run(() => actions.reorderTables(ids), "表顺序保存失败，请重试")} onUndo={() => run(undoStorageChange, "当前会话没有可撤销的存储操作")} />;

  const mainContent = <main className="morfra-storage-canvas" aria-label="Morfra 项目工作区">
    {project && activeTable && activeView ? <section className="morfra-storage-surface">
      <TableHeader table={activeTable} onRename={(name) => run(() => actions.renameTable(activeTable.id, name), "表重命名失败，请重试")} />
      <ViewTabBar tableId={activeTable.id} views={activeTable.views} activeViewId={activeView.id} onSelect={(id) => setActiveView(activeTable.id, id)} onCreate={(name, type) => run(() => actions.createView(activeTable.id, name, type), "新建视图失败，请重试")} onRename={(id, name) => run(() => actions.renameView(id, name), "视图重命名失败，请重试")} onDuplicate={(id, name) => run(() => actions.duplicateView(id, name), "复制视图失败，请重试")} onDelete={(id) => run(() => actions.deleteView(id), "删除视图失败，请重试")} onReorder={(ids) => run(() => actions.reorderViews(activeTable.id, ids), "视图顺序保存失败，请重试")} />
      <ViewToolbar view={activeView} />
      <div className="morfra-storage-data-area">
        <div className="morfra-data-area-heading"><div><p className="morfra-data-area-kicker">{activeView.viewType === "board" ? "看板" : "数据表"}</p><h2>{activeTable.name}</h2><p>当前视图：{activeView.name} · {activeTable.recordCount} 条记录</p></div><span className="morfra-data-area-id">{activeTable.titleFieldId}</span></div>
        {activeTable.recordCount === 0 && <div className="morfra-storage-empty"><span aria-hidden="true">○</span><p>当前表暂无记录</p><small>空项目已准备就绪，下一阶段接入记录和字段操作。</small></div>}
      </div>
    </section> : <div className="morfra-storage-empty morfra-storage-empty-project"><span aria-hidden="true">□</span><p>没有打开的项目</p><small>从文件菜单打开本地项目，或从项目切换器创建空白项目。</small></div>}
    {error && <p role="alert" className="morfra-storage-error">{error}</p>}
  </main>;

  if (embedded) return <div className="theme-module-board morfra-storage-embedded" data-testid="storage-workspace">{mainContent}</div>;

  return <div className="morfra-standalone-storage" data-testid="storage-workspace">
    <aside className="morfra-standalone-sidebar"><ProjectSwitcher />{tableList}<button type="button" className="morfra-close-project" onClick={() => void closeProject()}>关闭项目</button></aside>
    {mainContent}
  </div>;
}

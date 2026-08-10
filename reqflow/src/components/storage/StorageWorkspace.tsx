import { useEffect, useMemo, useState } from "react";
import { currentProject, useProjectStore } from "../../stores/projectStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { ProjectSwitcher } from "../sidebar/ProjectSwitcher";
import { TableList } from "../sidebar/TableList";
import { TableHeader } from "../workspace/TableHeader";
import { ViewTabBar } from "../workspace/ViewTabBar";
import { ViewToolbar } from "../workspace/ViewToolbar";
import { FieldManager } from "../fields/FieldManager";
import { RecordTable } from "../fields/RecordTable";
import { FieldDisplayManager } from "../fields/FieldDisplayManager";
import { useTableDataStore } from "../../stores/tableDataStore";
import { useStorageSelectionStore } from "../../stores/storageSelectionStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { getStorageViewConfig, updateStorageViewConfig } from "../../lib/ipc/storageClient";

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
  const [fieldManagerOpen, setFieldManagerOpen] = useState(false);
  const [fieldDisplayOpen, setFieldDisplayOpen] = useState(false);
  const [fieldDisplayIds, setFieldDisplayIds] = useState<string[] | null>(null);
  const [detailFieldsOpen, setDetailFieldsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewConfigError, setViewConfigError] = useState<string | null>(null);

  const tables = project?.storageSnapshot?.tables ?? [];
  const activeTableId = project ? activeTableByProject[project.id] ?? tables[0]?.id ?? null : null;
  const activeTable = tables.find((table) => table.id === activeTableId) ?? tables[0] ?? null;
  const activeViewId = activeTable ? activeViewByTable[activeTable.id] ?? activeTable.views[0]?.id ?? null : null;
  const activeView = activeTable?.views.find((view) => view.id === activeViewId) ?? activeTable?.views[0] ?? null;
  const tableData = useTableDataStore((state) => activeTable ? state.dataByTable[activeTable.id] : undefined);
  const tableDataLoading = useTableDataStore((state) => activeTable ? state.loadingByTable[activeTable.id] === true : false);
  const loadTableData = useTableDataStore((state) => state.load);
  const createRecord = useTableDataStore((state) => state.createRecord);
  const updateCell = useTableDataStore((state) => state.updateCell);
  const deleteRecord = useTableDataStore((state) => state.deleteRecord);
  const selectRecord = useStorageSelectionStore((state) => state.selectRecord);
  const detailOpen = useLayoutStore((state) => state.detailOpen);
  const toggleDetail = useLayoutStore((state) => state.toggleDetail);
  const setActiveRightPanel = useLayoutStore((state) => state.setActiveRightPanel);
  const detailFields = useStorageSelectionStore((state) => activeTable ? state.detailFieldsByTable[activeTable.id] : undefined);
  const detailLoadError = useStorageSelectionStore((state) => activeTable ? state.detailLoadErrorByTable[activeTable.id] : undefined);
  const loadDetailFields = useStorageSelectionStore((state) => state.loadDetailFields);
  const setDetailFields = useStorageSelectionStore((state) => state.setDetailFields);

  useEffect(() => {
    if (!project || !activeTable) return;
    if (activeTableByProject[project.id] !== activeTable.id) setActiveTable(project.id, activeTable.id);
    const firstView = activeTable.views[0];
    if (firstView && activeViewByTable[activeTable.id] !== firstView.id && !activeTable.views.some((view) => view.id === activeViewByTable[activeTable.id])) setActiveView(activeTable.id, firstView.id);
  }, [activeTable, activeTableByProject, activeViewByTable, project, setActiveTable, setActiveView]);

  useEffect(() => {
    if (activeTable && !tableData && !tableDataLoading) void loadTableData(activeTable.id).catch(() => setError("字段和记录读取失败，请重试"));
  }, [activeTable, loadTableData, tableData, tableDataLoading]);

  useEffect(() => {
    if (!activeView || !tableData) { setFieldDisplayIds(null); return; }
    let cancelled = false;
    setViewConfigError(null);
    const currentIds = tableData.fields.map((field) => field.id);
    const applyIds = (ids: string[] | null) => {
      if (cancelled) return;
      const titleId = tableData.fields.find((field) => field.isTitle)?.id;
      const validIds = ids?.filter((id) => currentIds.includes(id) && id !== titleId) ?? [];
      const orderedIds = titleId ? [titleId, ...validIds, ...currentIds.filter((id) => id !== titleId && !validIds.includes(id))] : currentIds;
      setFieldDisplayIds(orderedIds);
    };
    void getStorageViewConfig(activeView.id).then((config) => {
      setViewConfigError(null);
      const ids = config && typeof config === "object" && !Array.isArray(config) && Array.isArray(config.fieldIds) ? config.fieldIds.filter((id): id is string => typeof id === "string") : null;
      applyIds(ids);
    }).catch(() => {
    setViewConfigError("当前视图配置读取失败，已使用本地缓存");
    try {
      const raw = window.localStorage.getItem(`morfra.storage.view-fields.${activeView.id}`);
      const stored = raw ? JSON.parse(raw) : null;
      const storedIds = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string" && currentIds.includes(id)) : [];
      applyIds(storedIds);
    } catch { applyIds(null); }
    });
    return () => { cancelled = true; };
  }, [activeView, tableData?.fields]);

  useEffect(() => { if (activeTable && detailFields === undefined) loadDetailFields(activeTable.id); }, [activeTable, detailFields, loadDetailFields]);

  function setViewFieldIds(fieldIds: string[]) {
    if (!activeView) return;
    const previous = fieldDisplayIds;
    setFieldDisplayIds(fieldIds);
    void updateStorageViewConfig(activeView.id, { fieldIds }).then(() => {
      try { window.localStorage.setItem(`morfra.storage.view-fields.${activeView.id}`, JSON.stringify(fieldIds)); } catch { /* 本地缓存失败不影响已保存配置 */ }
    }).catch(() => {
      setFieldDisplayIds(previous);
      setError("当前视图字段显示保存失败，已恢复");
    });
  }

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
      <TableHeader table={{ ...activeTable, recordCount: tableData?.records.length ?? activeTable.recordCount }} onRename={(name) => run(() => actions.renameTable(activeTable.id, name), "表重命名失败，请重试")} onOpenFieldManager={() => setFieldManagerOpen(true)} onOpenDetailFields={() => setDetailFieldsOpen(true)} />
      <ViewTabBar tableId={activeTable.id} views={activeTable.views} activeViewId={activeView.id} onSelect={(id) => setActiveView(activeTable.id, id)} onCreate={(name, type) => run(() => actions.createView(activeTable.id, name, type), "新建视图失败，请重试")} onRename={(id, name) => run(() => actions.renameView(id, name), "视图重命名失败，请重试")} onDuplicate={(id, name) => run(() => actions.duplicateView(id, name), "复制视图失败，请重试")} onDelete={(id) => run(() => actions.deleteView(id), "删除视图失败，请重试")} onReorder={(ids) => run(() => actions.reorderViews(activeTable.id, ids), "视图顺序保存失败，请重试")} />
      <ViewToolbar view={activeView} onOpenFieldDisplay={() => setFieldDisplayOpen(true)} />
      <div className="morfra-storage-data-area">
        <div className="morfra-data-area-heading"><div><p className="morfra-data-area-kicker">{activeView.viewType === "board" ? "看板" : "数据表"}</p><h2>{activeTable.name}</h2><p>当前视图：{activeView.name} · {tableData?.records.length ?? activeTable.recordCount} 条记录</p></div><span className="morfra-data-area-id">主标题固定首列</span></div>
        {tableDataLoading && <div className="morfra-storage-empty"><span aria-hidden="true">…</span><p>正在读取字段和记录</p><small>数据区域保持稳定，完成后即可编辑。</small></div>}
        {tableData && <RecordTable data={tableData} visibleFieldIds={fieldDisplayIds ?? tableData.fields.map((field) => field.id)} onCreate={() => run(() => createRecord(activeTable.id, { [activeTable.titleFieldId]: "未命名记录" }).then(() => undefined), "新建记录失败，请重试")} onUpdate={(recordId, fieldId, value) => run(() => updateCell(recordId, fieldId, value).then(() => undefined), "记录保存失败，请重试")} onDelete={(recordId) => run(() => deleteRecord(recordId).then(() => undefined), "删除记录失败，请重试")} onOpenDetail={(recordId) => { selectRecord(activeTable.id, recordId); setActiveRightPanel("detail"); if (!detailOpen) toggleDetail(); }} />}
        {!tableDataLoading && !tableData && <div className="morfra-storage-empty"><span aria-hidden="true">○</span><p>字段和记录暂不可用</p><small>请重试或重新打开项目。</small></div>}
        {viewConfigError && <p role="alert" className="morfra-storage-error">{viewConfigError}</p>}
        {detailLoadError && <p role="alert" className="morfra-storage-error">{detailLoadError}<button type="button" className="ml-2 underline" onClick={() => { if (activeTable) void loadDetailFields(activeTable.id); }}>重试</button></p>}
      </div>
    </section> : <div className="morfra-storage-empty morfra-storage-empty-project"><span aria-hidden="true">□</span><p>没有打开的项目</p><small>从文件菜单打开本地项目，或从项目切换器创建空白项目。</small></div>}
    {error && <p role="alert" className="morfra-storage-error">{error}{activeTable && <button type="button" className="ml-2 underline" onClick={() => { setError(null); void loadTableData(activeTable.id).catch(() => setError("字段和记录读取失败，请重试")); }}>重试</button>}</p>}
    {fieldManagerOpen && tableData && <FieldManager tableId={activeTable.id} data={tableData} onClose={() => setFieldManagerOpen(false)} onError={setError} />}
    {fieldDisplayOpen && tableData && fieldDisplayIds && <FieldDisplayManager fields={tableData.fields} selectedIds={fieldDisplayIds} onChange={setViewFieldIds} onClose={() => setFieldDisplayOpen(false)} />}
    {detailFieldsOpen && tableData && detailFields && <FieldDisplayManager fields={tableData.fields.filter((field) => !field.isTitle)} selectedIds={detailFields} title="详情显示字段" description="只影响记录详情属性栏，不联动表格字段显示。" onChange={(fieldIds) => { void setDetailFields(activeTable.id, fieldIds).catch(() => setError("详情字段保存失败，已恢复")); }} onClose={() => setDetailFieldsOpen(false)} />}
  </main>;

  if (embedded) return <div className="theme-module-board morfra-storage-embedded" data-testid="storage-workspace">{mainContent}</div>;

  return <div className="morfra-standalone-storage" data-testid="storage-workspace">
    <aside className="morfra-standalone-sidebar"><ProjectSwitcher />{tableList}<button type="button" className="morfra-close-project" onClick={() => void closeProject()}>关闭项目</button></aside>
    {mainContent}
  </div>;
}

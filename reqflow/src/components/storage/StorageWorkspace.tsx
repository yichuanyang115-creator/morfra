import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { currentProject, useProjectStore } from "../../stores/projectStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { ProjectSwitcher } from "../sidebar/ProjectSwitcher";
import { TableList } from "../sidebar/TableList";
import { TableHeader } from "../workspace/TableHeader";
import { ViewTabBar } from "../workspace/ViewTabBar";
import { ViewToolbar } from "../workspace/ViewToolbar";
import { FieldManager } from "../fields/FieldManager";
import { FieldDisplayManager } from "../fields/FieldDisplayManager";
import { useTableDataStore } from "../../stores/tableDataStore";
import { useStorageSelectionStore } from "../../stores/storageSelectionStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { getStorageViewConfig, updateStorageViewConfig } from "../../lib/ipc/storageClient";
import { DataGrid, DataGridLoadingSkeleton, normalizeGridFieldIds, normalizeGridGroupOrder, orderGridFieldIdsByGroup, parseGridLayout, type GridLayoutConfig } from "../table/DataGrid";
import type { JsonValue } from "../../types/domain";
import { EMPTY_VIEW_PIPELINE, runViewPipeline, type ViewPipelineConfig } from "../../lib/table/viewPipeline";
import { uniqueProjectedRecordCount } from "../../lib/table/groupProjection";
import { GroupBar } from "../table/tools/GroupBar";
import { createGridLayoutSaveCoordinator, gridLayoutSaveRollback, parseCachedGridLayout, parseLoadingGridLayout, resetGridFieldLayout, shouldRollbackGridLayoutSave, shouldShowGridSkeleton } from "./storageGridLayout";
export { createGridLayoutSaveCoordinator, gridLayoutSaveRollback, parseCachedGridLayout, parseLoadingGridLayout, resetGridFieldLayout, shouldRollbackGridLayoutSave, shouldShowGridSkeleton } from "./storageGridLayout";

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
  const [gridLayout, setGridLayout] = useState<GridLayoutConfig | null>(null);
  const [gridLayoutViewId, setGridLayoutViewId] = useState<string | null>(null);
  const gridLayoutSaveVersion = useRef(0);
  const gridLayoutReadVersions = useRef(new Map<string, number>());
  const gridLayoutSaveCoordinator = useRef(createGridLayoutSaveCoordinator());
  const pendingGridLayouts = useRef(new Map<string, GridLayoutConfig>());
  const activeViewIdRef = useRef<string | null>(null);
  const [detailFieldsOpen, setDetailFieldsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewConfigError, setViewConfigError] = useState<string | null>(null);
  const [viewConfigRetry, setViewConfigRetry] = useState(0);
  const [gridSearch, setGridSearch] = useState("");

  const tables = project?.storageSnapshot?.tables ?? [];
  const activeTableId = project ? activeTableByProject[project.id] ?? tables[0]?.id ?? null : null;
  const activeTable = tables.find((table) => table.id === activeTableId) ?? tables[0] ?? null;
  const activeViewId = activeTable ? activeViewByTable[activeTable.id] ?? activeTable.views[0]?.id ?? null : null;
  const activeView = activeTable?.views.find((view) => view.id === activeViewId) ?? activeTable?.views[0] ?? null;
  const tableData = useTableDataStore((state) => activeTable ? state.dataByTable[activeTable.id] : undefined);
  const tableDataLoading = useTableDataStore((state) => activeTable ? state.loadingByTable[activeTable.id] === true : false);
  const tableDataError = useTableDataStore((state) => activeTable ? state.errorByTable[activeTable.id] : undefined);
  const loadTableData = useTableDataStore((state) => state.load);
  const createRecord = useTableDataStore((state) => state.createRecord);
  const updateCell = useTableDataStore((state) => state.updateCell);
  const applyTableMutation = useTableDataStore((state) => state.applyTableMutation);
  const reorderRecords = useTableDataStore((state) => state.reorderRecords);
  const selectRecord = useStorageSelectionStore((state) => state.selectRecord);
  const detailOpen = useLayoutStore((state) => state.detailOpen);
  const toggleDetail = useLayoutStore((state) => state.toggleDetail);
  const setActiveRightPanel = useLayoutStore((state) => state.setActiveRightPanel);
  const detailFields = useStorageSelectionStore((state) => activeTable ? state.detailFieldsByTable[activeTable.id] : undefined);
  const detailLoadError = useStorageSelectionStore((state) => activeTable ? state.detailLoadErrorByTable[activeTable.id] : undefined);
  const loadDetailFields = useStorageSelectionStore((state) => state.loadDetailFields);
  const setDetailFields = useStorageSelectionStore((state) => state.setDetailFields);
  const loadingGridLayout = useMemo(() => {
    if (gridLayout && gridLayoutViewId === activeView?.id) return gridLayout;
    if (!activeView || !activeTable) return null;
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(`morfra.storage.view-fields.${activeView.id}`); } catch { /* 本地缓存不可读时使用标题列骨架 */ }
    return parseLoadingGridLayout(raw, activeTable.titleFieldId);
  }, [activeTable, activeView, gridLayout, gridLayoutViewId]);

  useLayoutEffect(() => { activeViewIdRef.current = activeView?.id ?? null; }, [activeView?.id]);
  useEffect(() => { setGridSearch(""); }, [activeView?.id]);

  function nextGridLayoutReadVersion(viewId: string): number {
    const next = (gridLayoutReadVersions.current.get(viewId) ?? 0) + 1;
    gridLayoutReadVersions.current.set(viewId, next);
    return next;
  }

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
    if (!activeView || !tableData) { setFieldDisplayIds(null); setGridLayout(null); setGridLayoutViewId(null); return; }
    let cancelled = false;
    const viewId = activeView.id;
    const readVersion = nextGridLayoutReadVersion(viewId);
    setViewConfigError(null);
    const initialLayout = pendingGridLayouts.current.get(viewId) ?? gridLayoutSaveCoordinator.current.getConfirmed(viewId);
    if (initialLayout) { setFieldDisplayIds(initialLayout.fieldIds); setGridLayout(initialLayout); setGridLayoutViewId(viewId); }
    const applyLayout = (config: Parameters<typeof parseGridLayout>[0]) => {
      if (cancelled || gridLayoutReadVersions.current.get(viewId) !== readVersion) return;
      const persistedLayout = parseGridLayout(config, tableData.fields, tableData.groups);
      const pendingLayout = pendingGridLayouts.current.get(activeView.id);
      const layout = pendingLayout ?? persistedLayout;
      if (!pendingLayout) gridLayoutSaveCoordinator.current.confirm(activeView.id, persistedLayout);
      setFieldDisplayIds(layout.fieldIds);
      setGridLayout(layout);
      setGridLayoutViewId(activeView.id);
    };
    void getStorageViewConfig(activeView.id).then((config) => {
      setViewConfigError(null);
      applyLayout(config);
    }).catch(() => {
    setViewConfigError("当前视图配置读取失败，已使用本地缓存");
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(`morfra.storage.view-fields.${activeView.id}`); } catch { /* 本地缓存不可读时使用默认布局 */ }
    const persistedLayout = parseCachedGridLayout(raw, tableData.fields, tableData.groups);
    const pendingLayout = pendingGridLayouts.current.get(activeView.id);
    const layout = pendingLayout ?? persistedLayout;
    if (!cancelled && gridLayoutReadVersions.current.get(viewId) === readVersion) { if (!pendingLayout) gridLayoutSaveCoordinator.current.confirm(activeView.id, persistedLayout); setFieldDisplayIds(layout.fieldIds); setGridLayout(layout); setGridLayoutViewId(activeView.id); }
    });
    return () => { cancelled = true; };
  }, [activeView, tableData?.fields, viewConfigRetry]);

  useEffect(() => { if (activeTable && detailFields === undefined) loadDetailFields(activeTable.id); }, [activeTable, detailFields, loadDetailFields]);

  function setGridLayoutConfig(next: GridLayoutConfig) {
    if (!activeView || !tableData || gridLayoutViewId !== activeView.id) return;
    const groupOrder = normalizeGridGroupOrder(next.groupOrder, tableData.fields, tableData.groups);
    const normalizedNext = { ...next, fieldIds: orderGridFieldIdsByGroup(normalizeGridFieldIds(next.fieldIds, tableData.fields), tableData.fields, groupOrder), groupOrder };
    const previous = gridLayout;
    const previousFieldDisplayIds = fieldDisplayIds;
    const viewId = activeView.id;
    const version = ++gridLayoutSaveVersion.current;
    nextGridLayoutReadVersion(viewId);
    pendingGridLayouts.current.set(viewId, normalizedNext);
    setGridLayout(normalizedNext);
    setFieldDisplayIds(normalizedNext.fieldIds);
    const persist = async () => {
      try {
        const pipeline = normalizedNext.pipeline ?? EMPTY_VIEW_PIPELINE;
        await updateStorageViewConfig(viewId, { fieldIds: normalizedNext.fieldIds, groupOrder: normalizedNext.groupOrder, columnWidths: normalizedNext.columnWidths, frozenFieldId: normalizedNext.frozenFieldId, rowHeight: normalizedNext.rowHeight, collapsedGroupIds: normalizedNext.collapsedGroupIds, filters: pipeline.filters, filterMode: pipeline.filterMode, sorts: pipeline.sorts, group: pipeline.group, conditionalColors: pipeline.conditionalColors } as unknown as JsonValue);
        gridLayoutSaveCoordinator.current.confirm(viewId, normalizedNext);
        if (pendingGridLayouts.current.get(viewId) === normalizedNext) pendingGridLayouts.current.delete(viewId);
        nextGridLayoutReadVersion(viewId);
        try { window.localStorage.setItem(`morfra.storage.view-fields.${viewId}`, JSON.stringify(normalizedNext)); } catch { /* 本地缓存失败不影响已保存配置 */ }
      } catch {
        if (pendingGridLayouts.current.get(viewId) === normalizedNext) pendingGridLayouts.current.delete(viewId);
        nextGridLayoutReadVersion(viewId);
        if (!shouldRollbackGridLayoutSave(gridLayoutSaveVersion.current, version, activeViewIdRef.current, viewId)) return;
        const restored = gridLayoutSaveRollback(gridLayoutSaveCoordinator.current.getConfirmed(viewId), previous);
        setGridLayout(restored);
        setGridLayoutViewId(restored ? viewId : null);
        setFieldDisplayIds(restored?.fieldIds ?? previousFieldDisplayIds);
        setError("当前视图布局保存失败，已恢复");
      }
    };
    void gridLayoutSaveCoordinator.current.enqueue(persist);
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
  const gridLayoutReady = Boolean(tableData && gridLayout && gridLayoutViewId === activeView?.id);
  const showGridSkeleton = shouldShowGridSkeleton(Boolean(tableData), tableDataLoading, gridLayoutReady, Boolean(tableDataError));
  const pipelineResult = useMemo(() => {
    if (!tableData || !gridLayout) return null;
    return runViewPipeline(tableData, gridLayout.pipeline ?? EMPTY_VIEW_PIPELINE, gridSearch);
  }, [gridLayout, gridSearch, tableData]);
  const processedGridData = tableData && pipelineResult ? { ...tableData, records: pipelineResult.records } : tableData;
  const groupField = tableData?.fields.find((field) => field.id === gridLayout?.pipeline?.group.fieldId);
  const groupProjection = pipelineResult?.groups ?? [];
  const changePipeline = (pipeline: ViewPipelineConfig) => { if (gridLayout) setGridLayoutConfig({ ...gridLayout, pipeline }); };
  const createGroupedRecord = async (key: string) => {
    if (!groupField || !activeTable || !tableData) return;
    const title = window.prompt("新记录标题");
    if (!title?.trim()) return;
    const value: JsonValue = key === "__empty__" ? null : groupField.fieldType === "multi_select" ? [key] : groupField.fieldType === "checkbox" ? key === "true" : groupField.fieldType === "number" || groupField.fieldType === "progress" ? Number(key) : key;
    const previousIds = new Set(tableData.records.map((record) => record.id));
    const snapshot = await createRecord(activeTable.id, { [activeTable.titleFieldId]: title.trim(), [groupField.id]: value });
    const created = snapshot.records.find((record) => !previousIds.has(record.id));
    const visibleIds = new Set(runViewPipeline(snapshot, gridLayout?.pipeline ?? EMPTY_VIEW_PIPELINE, gridSearch).records.map((record) => record.id));
    if (created && !visibleIds.has(created.id)) setError("记录已创建，但不符合当前筛选条件");
  };

  const mainContent = <main className="morfra-storage-canvas" aria-label="Morfra 项目工作区">
    {project && activeTable && activeView ? <section className="morfra-storage-surface">
      <TableHeader table={{ ...activeTable, recordCount: tableData?.records.length ?? activeTable.recordCount }} onRename={(name) => run(() => actions.renameTable(activeTable.id, name), "表重命名失败，请重试")} onOpenFieldManager={() => setFieldManagerOpen(true)} onOpenDetailFields={() => setDetailFieldsOpen(true)} />
      <ViewTabBar tableId={activeTable.id} views={activeTable.views} activeViewId={activeView.id} onSelect={(id) => setActiveView(activeTable.id, id)} onCreate={(name, type) => run(() => actions.createView(activeTable.id, name, type), "新建视图失败，请重试")} onRename={(id, name) => run(() => actions.renameView(id, name), "视图重命名失败，请重试")} onDuplicate={(id, name) => run(() => actions.duplicateView(id, name), "复制视图失败，请重试")} onDelete={(id) => run(() => actions.deleteView(id), "删除视图失败，请重试")} onReorder={(ids) => run(() => actions.reorderViews(activeTable.id, ids), "视图顺序保存失败，请重试")} />
      <ViewToolbar view={activeView} fields={tableData?.fields} visibleFieldCount={gridLayout?.fieldIds.length} pipeline={gridLayout?.pipeline ?? EMPTY_VIEW_PIPELINE} search={gridSearch} rowHeight={gridLayout?.rowHeight} onSearchChange={setGridSearch} onRowHeightChange={(rowHeight) => { if (gridLayout) setGridLayoutConfig({ ...gridLayout, rowHeight }); }} onPipelineChange={changePipeline} onOpenFieldDisplay={() => setFieldDisplayOpen(true)} />
      <div className="morfra-storage-data-area">
        <div className="morfra-data-area-heading"><div><p className="morfra-data-area-kicker">{activeView.viewType === "board" ? "看板" : "数据表"}</p><h2>{activeTable.name}</h2><p>当前视图：{activeView.name} · {tableData?.records.length ?? activeTable.recordCount} 条记录</p></div><span className="morfra-data-area-id">主标题固定首列</span></div>
        {groupField && gridLayout && <GroupBar groups={groupProjection} uniqueCount={uniqueProjectedRecordCount(groupProjection)} collapsedKeys={(gridLayout.pipeline ?? EMPTY_VIEW_PIPELINE).group.collapsedKeys} canCreate={!['created_time', 'updated_time'].includes(groupField.fieldType)} onToggle={(key) => { const current = (gridLayout.pipeline ?? EMPTY_VIEW_PIPELINE).group; changePipeline({ ...(gridLayout.pipeline ?? EMPTY_VIEW_PIPELINE), group: { ...current, collapsedKeys: current.collapsedKeys.includes(key) ? current.collapsedKeys.filter((item) => item !== key) : [...current.collapsedKeys, key] } }); }} onCreate={(key) => void run(() => createGroupedRecord(key), "新建分组记录失败，请重试")} onExpandAll={() => changePipeline({ ...(gridLayout.pipeline ?? EMPTY_VIEW_PIPELINE), group: { ...(gridLayout.pipeline ?? EMPTY_VIEW_PIPELINE).group, collapsedKeys: [] } })} onCollapseAll={() => changePipeline({ ...(gridLayout.pipeline ?? EMPTY_VIEW_PIPELINE), group: { ...(gridLayout.pipeline ?? EMPTY_VIEW_PIPELINE).group, collapsedKeys: groupProjection.map((group) => group.key) } })} />}
        {showGridSkeleton && loadingGridLayout && <DataGridLoadingSkeleton config={loadingGridLayout} />}
        {tableDataLoading && gridLayoutReady && <div className="morfra-grid-refresh-indicator" role="status">正在刷新表格数据…</div>}
        {pipelineResult && tableData && pipelineResult.matched === 0 && tableData.records.length > 0 && <div className="morfra-grid-no-results" role="status"><span>当前搜索或筛选没有匹配记录。</span>{gridSearch && <button type="button" onClick={() => setGridSearch("")}>清除搜索</button>}{(gridLayout?.pipeline?.filters.length ?? 0) > 0 && <button type="button" onClick={() => changePipeline({ ...(gridLayout?.pipeline ?? EMPTY_VIEW_PIPELINE), filters: [] })}>清除筛选</button>}</div>}
        {processedGridData && gridLayout && gridLayoutViewId === activeView.id && <DataGrid viewId={activeView.id} data={processedGridData} config={gridLayout} recordGroups={pipelineResult?.recordGroups} groups={pipelineResult?.groups} groupField={groupField} manualRecordIds={tableData?.records.map((record) => record.id) ?? []} onConfigChange={setGridLayoutConfig} onCreate={() => void run(() => createRecord(activeTable.id, { [activeTable.titleFieldId]: "未命名记录" }).then(() => undefined), "新建记录失败，请重试")} onCreateInGroup={(key) => void run(() => createGroupedRecord(key), "新建分组记录失败，请重试")} onUpdateCell={updateCell} onApplyTableMutation={(tableId, plan, deleteRecordIds) => applyTableMutation(tableId, plan.updates, plan.newRecords, deleteRecordIds)} onReorderRecords={(recordIds) => reorderRecords(activeTable.id, recordIds)} onUndo={async () => { await undoStorageChange(); await loadTableData(activeTable.id); }} onOpenDetail={(recordId) => { selectRecord(activeTable.id, recordId); setActiveRightPanel("detail"); if (!detailOpen) toggleDetail(); }} />}
        {!tableDataLoading && !tableData && !showGridSkeleton && <div className="morfra-storage-empty"><span aria-hidden="true">○</span><p>字段和记录暂不可用</p><small>请重试或重新打开项目。</small></div>}
        {viewConfigError && <p role="alert" className="morfra-storage-error">{viewConfigError}<button type="button" className="ml-2 underline" onClick={() => setViewConfigRetry((version) => version + 1)}>重试</button></p>}
        {detailLoadError && <p role="alert" className="morfra-storage-error">{detailLoadError}<button type="button" className="ml-2 underline" onClick={() => { if (activeTable) void loadDetailFields(activeTable.id); }}>重试</button></p>}
      </div>
    </section> : <div className="morfra-storage-empty morfra-storage-empty-project"><span aria-hidden="true">□</span><p>没有打开的项目</p><small>从文件菜单打开本地项目，或从项目切换器创建空白项目。</small></div>}
    {error && <p role="alert" className="morfra-storage-error">{error}{activeTable && <button type="button" className="ml-2 underline" onClick={() => { setError(null); void loadTableData(activeTable.id).catch(() => setError("字段和记录读取失败，请重试")); }}>重试</button>}</p>}
    {fieldManagerOpen && tableData && <FieldManager tableId={activeTable.id} data={tableData} onClose={() => setFieldManagerOpen(false)} onError={setError} />}
    {fieldDisplayOpen && tableData && fieldDisplayIds && gridLayout && gridLayoutViewId === activeView?.id && <FieldDisplayManager fields={tableData.fields} groups={tableData.groups} selectedIds={fieldDisplayIds} groupOrder={gridLayout.groupOrder} onChange={(fieldIds, groupOrder) => setGridLayoutConfig({ ...gridLayout, fieldIds, groupOrder: groupOrder ?? gridLayout.groupOrder })} onReset={() => setGridLayoutConfig(resetGridFieldLayout(gridLayout, tableData.fields.map((field) => field.id)))} onClose={() => setFieldDisplayOpen(false)} />}
    {detailFieldsOpen && tableData && detailFields && <FieldDisplayManager fields={tableData.fields.filter((field) => !field.isTitle)} selectedIds={detailFields} title="详情显示字段" description="只影响记录详情属性栏，不联动表格字段显示。" onChange={(fieldIds) => { void setDetailFields(activeTable.id, fieldIds).catch(() => setError("详情字段保存失败，已恢复")); }} onClose={() => setDetailFieldsOpen(false)} />}
  </main>;

  if (embedded) return <div className="theme-module-board morfra-storage-embedded" data-testid="storage-workspace">{mainContent}</div>;

  return <div className="morfra-standalone-storage" data-testid="storage-workspace">
    <aside className="morfra-standalone-sidebar"><ProjectSwitcher />{tableList}<button type="button" className="morfra-close-project" onClick={() => void closeProject()}>关闭项目</button></aside>
    {mainContent}
  </div>;
}

import { useEffect, useState } from "react";
import { currentProject, useProjectStore } from "../../stores/projectStore";

export function StorageWorkspace() {
  const projects = useProjectStore((state) => state.projects);
  const project = useProjectStore(currentProject);
  const switchProject = useProjectStore((state) => state.switchProject);
  const createProject = useProjectStore((state) => state.createProject);
  const closeProject = useProjectStore((state) => state.closeProject);
  const createTable = useProjectStore((state) => state.createTable);
  const undoStorageChange = useProjectStore((state) => state.undoStorageChange);
  const [projectName, setProjectName] = useState("");
  const [tableName, setTableName] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tables = project?.storageSnapshot?.tables ?? [];
  const firstTable = tables[0] ?? null;
  const firstView = firstTable?.views[0] ?? null;

  useEffect(() => {
    setCanUndo(false);
  }, [project?.id]);

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    setError(null);
    try {
      await createProject(name);
      setProjectName("");
      setCanUndo(false);
    } catch {
      setError("项目包创建失败，请检查应用数据目录权限后重试");
    }
  }

  async function handleCreateTable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = tableName.trim();
    if (!name) return;
    setError(null);
    try {
      await createTable(name);
      setTableName("");
      setCanUndo(true);
    } catch {
      setError("新建表失败，事务未写入部分数据");
    }
  }

  async function handleUndo() {
    setError(null);
    try {
      await undoStorageChange();
      setCanUndo(false);
    } catch {
      setError("当前会话没有可撤销的存储操作");
    }
  }

  async function handleClose() {
    setError(null);
    try {
      await closeProject();
      setCanUndo(false);
    } catch {
      setError("项目关闭失败，请重试");
    }
  }

  async function handleSwitch(id: string) {
    setError(null);
    try {
      await switchProject(id);
      setCanUndo(false);
    } catch {
      setError("项目打开失败，请检查项目包完整性");
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-(--module-scope-background-canvas) text-(--module-scope-text-primary)" data-testid="storage-workspace">
      <header className="flex h-12 flex-none items-center justify-between border-b border-(--module-scope-border-subtle) px-5">
        <div className="min-w-0">
          <p className="m-0 text-[11px] text-(--module-scope-text-tertiary)">Morfra 本地项目包</p>
          <h1 className="m-0 truncate text-[15px] font-[590]">{project?.name ?? "没有打开的项目"}</h1>
        </div>
        {project && (
          <button type="button" onClick={() => void handleClose()} className="rounded border border-(--module-scope-border-subtle) bg-transparent px-2.5 py-1.5 text-[12px] hover:bg-(--module-scope-background-surface)">
            关闭项目
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 flex-none flex-col border-r border-(--module-scope-border-subtle) p-3">
          <div className="mb-2 text-[11px] font-[590] text-(--module-scope-text-secondary)">项目</div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {projects.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => void handleSwitch(item.id)}
                className={`mb-1 flex w-full items-center rounded px-2.5 py-2 text-left text-[13px] ${item.id === project?.id ? "bg-(--module-scope-action-soft) text-(--module-scope-action-strong)" : "hover:bg-(--module-scope-background-surface)"}`}
              >
                <span className="truncate">{item.name}</span>
              </button>
            ))}
          </div>
          <form onSubmit={(event) => void handleCreateProject(event)} className="mt-3 flex gap-1.5 border-t border-(--module-scope-border-subtle) pt-3">
            <input
              aria-label="新建 Morfra 项目名称"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="新建空白项目"
              className="min-w-0 flex-1 rounded border border-(--module-scope-border-subtle) bg-transparent px-2 py-1.5 text-[12px] outline-none focus:border-(--module-scope-action-base)"
            />
            <button type="submit" aria-label="创建项目" className="rounded bg-(--module-scope-action-strong) px-2.5 py-1.5 text-[12px] text-(--module-scope-background-surface)">新建</button>
          </form>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto p-6">
          {project && firstTable && firstView ? (
            <section className="mx-auto max-w-3xl">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="m-0 text-[11px] text-(--module-scope-text-tertiary)">当前表</p>
                  <h2 className="m-0 text-[20px] font-[590]">{firstTable.name}</h2>
                </div>
                <span className="rounded-full bg-(--module-scope-background-surface) px-2.5 py-1 text-[12px] text-(--module-scope-text-secondary)">{firstView.name} · 表格视图</span>
              </div>
              <div className="rounded-lg border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-[13px] font-[590]">数据区</p>
                    <p className="m-0 mt-1 text-[12px] text-(--module-scope-text-secondary)">主标题字段已创建，当前记录数：{firstTable.recordCount}</p>
                  </div>
                  <span className="font-mono text-[11px] text-(--module-scope-text-tertiary)">{firstTable.titleFieldId}</span>
                </div>
                {firstTable.recordCount === 0 && <p className="m-0 mt-8 text-center text-[13px] text-(--module-scope-text-secondary)">当前表暂无记录，空项目已准备就绪。</p>}
              </div>
              <form onSubmit={(event) => void handleCreateTable(event)} className="mt-5 flex max-w-sm gap-1.5">
                <input aria-label="新建表名称" value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="新建表" className="min-w-0 flex-1 rounded border border-(--module-scope-border-subtle) bg-transparent px-2 py-1.5 text-[12px] outline-none focus:border-(--module-scope-action-base)" />
                <button type="submit" className="rounded border border-(--module-scope-border-subtle) px-2.5 py-1.5 text-[12px] hover:bg-(--module-scope-background-surface)">新建表</button>
                <button type="button" disabled={!canUndo} onClick={() => void handleUndo()} className="rounded border border-(--module-scope-border-subtle) px-2.5 py-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-40">撤销</button>
              </form>
            </section>
          ) : (
            <div className="mx-auto max-w-xl rounded-lg border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-8 text-center">
              <p className="m-0 text-[15px] font-[590]">没有打开的项目</p>
              <p className="m-0 mt-2 text-[13px] text-(--module-scope-text-secondary)">从左侧重新打开一个本地 Morfra 项目包，或创建空白项目。</p>
            </div>
          )}
          {error && <p role="alert" className="mx-auto mt-4 max-w-xl text-[12px] text-(--module-scope-feedback-danger)">{error}</p>}
        </main>
      </div>
    </div>
  );
}

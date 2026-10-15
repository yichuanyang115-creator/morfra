import { useEffect, useState } from "react";
import type { BackupInfo, ProjectSnapshot } from "../../types/domain";
import { backupStorageProject, listStorageBackups, restoreStorageProject } from "../../lib/ipc/storageClient";
import { ConfirmDialog } from "../shared/ConfirmDialog";

export function BackupSettings({ onRestored, onClose }: { onRestored: (snapshot: ProjectSnapshot) => Promise<void>; onClose: () => void }) {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<BackupInfo | null>(null);
  const load = async () => { setError(null); try { setBackups(await listStorageBackups()); } catch { setError("备份列表读取失败，请重试"); } };
  useEffect(() => { void load(); }, []);
  const backup = async () => { setBusy(true); setError(null); try { await backupStorageProject(); await load(); } catch { setError("立即备份失败，当前项目未被更改，可重试。"); } finally { setBusy(false); } };
  const restore = async () => { if (!target) return; setBusy(true); setError(null); try { const snapshot = await restoreStorageProject(target.id); await onRestored(snapshot); setTarget(null); await load(); } catch { setError("恢复失败，当前项目保持原状态，可继续编辑或重试。"); } finally { setBusy(false); } };
  return <div className="fixed inset-0 z-60 flex items-stretch justify-end bg-(--overlay-scrim)" role="dialog" aria-modal="true" aria-labelledby="backup-settings-title"><section className="flex h-full w-[min(94vw,460px)] flex-col bg-(--module-scope-background-surface) p-5 shadow-(--shadow-panel)"><header className="flex items-start justify-between gap-3 border-b border-(--module-scope-border-subtle) pb-4"><div><h2 id="backup-settings-title" className="m-0 text-[16px] font-semibold">备份与恢复</h2><p className="m-0 mt-1 text-[11px] text-(--module-scope-text-tertiary)">每天首次打开、结构升级前都会自动备份；最多保留最近 7 份。</p></div><button type="button" className="text-[12px]" onClick={onClose}>关闭</button></header><div className="min-h-0 flex-1 overflow-y-auto py-4"><button type="button" disabled={busy} className="rounded-(--r-sm) bg-(--module-scope-action-base) px-3 py-1.5 text-[12px] text-(--module-scope-background-surface) disabled:opacity-50" onClick={() => void backup()}>立即备份</button><ul className="m-0 mt-4 space-y-2 p-0">{backups.map((item) => <li key={item.id} className="flex items-center justify-between gap-2 rounded-(--r-sm) border border-(--module-scope-border-subtle) p-2 text-[11px]"><span className="min-w-0 truncate">{item.id}</span><button type="button" disabled={busy} className="shrink-0 text-(--module-scope-action-base) underline" onClick={() => setTarget(item)}>恢复</button></li>)}{!backups.length && !error && <li className="text-[12px] text-(--module-scope-text-tertiary)">还没有可用备份。</li>}</ul>{error && <p role="alert" className="text-[12px] text-(--module-scope-feedback-danger)">{error}<button type="button" className="ml-2 underline" onClick={() => void load()}>重试</button></p>}</div>{target && <ConfirmDialog title="恢复此备份？" body="恢复前会先保护当前项目状态。恢复失败不会替换当前可编辑项目。" confirmLabel="恢复" onCancel={() => setTarget(null)} onConfirm={() => void restore()} />}</section></div>;
}

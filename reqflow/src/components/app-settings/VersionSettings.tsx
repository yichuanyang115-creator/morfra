import { useEffect } from "react";
import { useUpdateStore } from "../../stores/updateStore";

const checkButtonClass = "rounded-(--r-sm) border-none bg-(--accent-solid) px-3 py-1.75 text-[12.5px] text-(--accent-solid-fg) hover:opacity-90 disabled:cursor-not-allowed";

export function VersionSettings() {
  const status = useUpdateStore((state) => state.status);
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const release = useUpdateStore((state) => state.release);
  const downloadProgress = useUpdateStore((state) => state.downloadProgress);
  const errorMessage = useUpdateStore((state) => state.errorMessage);
  const loadVersion = useUpdateStore((state) => state.loadVersion);
  const checkUpdate = useUpdateStore((state) => state.checkUpdate);
  const downloadUpdate = useUpdateStore((state) => state.downloadUpdate);

  useEffect(() => {
    if (!currentVersion) void loadVersion();
  }, [currentVersion, loadVersion]);

  const isDownloadRetry = status === "error" && release != null;

  return (
    <section className="max-w-xl p-6">
      <div className="mb-5">
        <h1 className="m-0 text-[16px] font-[590] text-(--fg)">版本</h1>
        <p className="m-0 mt-1 text-[12.5px] text-(--muted)">当前版本与应用更新。</p>
      </div>
      <div className="rounded-(--r-md) border border-(--border) bg-(--surface) p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-[550] text-(--fg)">当前版本</span>
          <span className="font-(family-name:--font-mono) text-[12px] text-(--muted-2)">{currentVersion ? "v" + currentVersion : "…"}</span>
        </div>
        <div className="mt-4 border-t border-(--border) pt-4">
          {status === "idle" && <button type="button" onClick={() => void checkUpdate()} className={checkButtonClass}>检查更新</button>}
          {status === "checking" && <button type="button" disabled className={checkButtonClass + " opacity-60"}>检查中…</button>}
          {status === "up-to-date" && (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-[12.5px] text-(--muted)">已是最新版本</p>
              <button type="button" onClick={() => void checkUpdate()} className={checkButtonClass}>检查更新</button>
            </div>
          )}
          {status === "available" && release && (
            <div className="flex flex-col gap-2">
              <div className="rounded-(--r-md) bg-(--accent-soft) p-3">
                <p className="m-0 mb-1 text-[12.5px] font-[590] text-(--accent-text)">发现新版本 {release.version}</p>
                {release.notes && <p className="m-0 whitespace-pre-wrap text-[12px] text-(--muted)">{release.notes}</p>}
              </div>
              <button type="button" onClick={() => void downloadUpdate()} className={checkButtonClass}>下载更新</button>
            </div>
          )}
          {status === "downloading" && (
            <div>
              <p className="m-0 text-[12.5px] text-(--muted)">下载中 {downloadProgress}%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-(--surface-2)">
                <div className="h-full rounded-full bg-(--accent) transition-[width]" style={{ width: downloadProgress + "%" }} />
              </div>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-[12.5px] text-(--st-blocked)">{errorMessage}</p>
              <button type="button" onClick={() => void (isDownloadRetry ? downloadUpdate() : currentVersion ? checkUpdate() : loadVersion())} className={checkButtonClass}>重试</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

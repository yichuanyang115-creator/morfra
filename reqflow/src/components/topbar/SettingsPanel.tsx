import { useEffect } from "react";
import { useUpdateStore } from "../../stores/updateStore";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const status = useUpdateStore((s) => s.status);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const release = useUpdateStore((s) => s.release);
  const downloadProgress = useUpdateStore((s) => s.downloadProgress);
  const errorMessage = useUpdateStore((s) => s.errorMessage);
  const loadVersion = useUpdateStore((s) => s.loadVersion);
  const checkUpdate = useUpdateStore((s) => s.checkUpdate);
  const downloadUpdate = useUpdateStore((s) => s.downloadUpdate);

  useEffect(() => {
    if (!currentVersion) void loadVersion();
  }, [currentVersion, loadVersion]);

  const isDownloadRetry = status === "error" && release != null;

  return (
    <div
      className="fixed right-3 z-50 w-72 rounded-(--r-lg) border border-(--border-strong) bg-(--surface) p-3.5 shadow-[0_12px_32px_-8px_rgba(30,40,70,0.18),0_2px_8px_rgba(30,40,70,0.05)]"
      style={{ top: "calc(var(--topbar-h) + 6px)" }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-(family-name:--font-display) text-[13px] font-[590] text-(--fg)">版本</span>
        <span className="font-(family-name:--font-mono) text-[11px] text-(--muted-2)">
          {currentVersion ? `v${currentVersion}` : "…"}
        </span>
      </div>

      <div className="flex flex-col gap-2 border-t border-(--border) pt-2.5">
        {status === "idle" && (
          <button type="button" onClick={() => void checkUpdate()} className={checkButtonClass}>
            检查更新
          </button>
        )}

        {status === "checking" && (
          <button type="button" disabled className={`${checkButtonClass} opacity-60`}>
            检查中…
          </button>
        )}

        {status === "up-to-date" && (
          <>
            <p className="m-0 text-[12.5px] text-(--muted)">已是最新版本</p>
            <button type="button" onClick={() => void checkUpdate()} className={checkButtonClass}>
              检查更新
            </button>
          </>
        )}

        {status === "available" && release && (
          <>
            <div className="rounded-(--r-md) bg-(--accent-soft) p-2.25">
              <p className="m-0 mb-1 text-[12.5px] font-[590] text-(--accent-text)">发现新版本 {release.version}</p>
              {release.notes && <p className="m-0 whitespace-pre-wrap text-[12px] text-(--muted)">{release.notes}</p>}
            </div>
            <button type="button" onClick={() => void downloadUpdate()} className={checkButtonClass}>
              下载更新
            </button>
          </>
        )}

        {status === "downloading" && (
          <>
            <p className="m-0 text-[12.5px] text-(--muted)">下载中 {downloadProgress}%</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--surface-2)">
              <div
                className="h-full rounded-full bg-(--accent) transition-[width]"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <p className="m-0 text-[12.5px] text-(--st-blocked)">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void (isDownloadRetry ? downloadUpdate() : checkUpdate())}
              className={checkButtonClass}
            >
              重试
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full rounded-(--r-sm) border border-(--border-strong) bg-(--surface) px-3 py-1.5 text-[12.5px] text-(--fg) hover:bg-(--surface-2)"
      >
        关闭
      </button>
    </div>
  );
}

const checkButtonClass =
  "w-full rounded-(--r-sm) border-none bg-(--fg) px-3 py-1.75 text-[12.5px] text-(--surface) hover:opacity-90 disabled:cursor-not-allowed";

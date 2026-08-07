import { VersionSettings } from "../app-settings/VersionSettings";

interface SettingsPanelProps {
  onClose: () => void;
}

/** Phase 28 保留旧浮层导出，避免历史调用方断裂；顶栏入口已迁移到独立应用设置页。 */
export function SettingsPanel({ onClose }: SettingsPanelProps) {
  return (
    <div
      className="fixed right-3 z-50 w-72 rounded-(--r-lg) border border-(--border-strong) bg-(--surface) p-3.5 shadow-(--shadow-floating)"
      style={{ top: "calc(var(--topbar-h) + 6px)" }}
    >
      <VersionSettings />
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full rounded-(--r-sm) border border-(--border-strong) bg-(--surface) px-3 py-1.5 text-[12.5px] text-(--fg) hover:bg-(--accent-soft)"
      >
        关闭
      </button>
    </div>
  );
}

import type { AppSettingsSection } from "../../stores/uiStore";
import { AppSettingsNav } from "./AppSettingsNav";
import { AppearanceSettings } from "./AppearanceSettings";
import { VersionSettings } from "./VersionSettings";

interface AppSettingsPageProps {
  section: AppSettingsSection;
  onSelectSection: (section: AppSettingsSection) => void;
  onClose: () => void;
}

function CloseIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function AppSettingsPage({ section, onSelectSection, onClose }: AppSettingsPageProps) {
  return (
    <div data-theme-module="settings" className="theme-module-settings flex min-h-0 flex-1 flex-col bg-(--module-scope-background-surface)">
      <div className="flex flex-none items-center justify-between border-b border-(--module-scope-border-subtle) px-4.5 py-3">
        <span className="font-(family-name:--font-display) text-[15px] font-[590] text-(--module-scope-text-primary)">应用设置</span>
        <button type="button" onClick={onClose} aria-label="关闭应用设置" className="grid size-7 place-items-center rounded-(--r-sm) border-none bg-transparent text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)">
          <CloseIcon />
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <AppSettingsNav section={section} onSelect={onSelectSection} />
        {section === "appearance" ? <AppearanceSettings onClose={onClose} /> : <VersionSettings />}
      </div>
    </div>
  );
}

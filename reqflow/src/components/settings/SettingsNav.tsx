import type { Schema } from "../../types/schema";
import type { SettingsSection } from "../../stores/uiStore";

interface SettingsNavProps {
  schema: Schema;
  section: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}

function isActive(section: SettingsSection, candidate: SettingsSection): boolean {
  if (candidate.kind !== section.kind) return false;
  if (candidate.kind === "tab" && section.kind === "tab") return candidate.tabId === section.tabId;
  return true;
}

const navItemClass = (active: boolean) =>
  `block w-full rounded-(--r-sm) px-2.5 py-1.75 text-left font-(family-name:--font-body) text-[13px] ${
    active ? "bg-(--accent-soft) text-(--accent-text) font-[550]" : "text-(--muted) hover:bg-(--surface-2) hover:text-(--fg)"
  }`;

export function SettingsNav({ schema, section, onSelect }: SettingsNavProps) {
  return (
    <nav className="flex w-48 flex-none flex-col gap-3 border-r border-(--border) p-3">
      <div className="flex flex-col gap-0.5">
        <span className="px-2.5 py-1 font-(family-name:--font-mono) text-[11px] tracking-[0.04em] text-(--muted-2)">结构</span>
        <button type="button" onClick={() => onSelect({ kind: "stages" })} className={navItemClass(isActive(section, { kind: "stages" }))}>
          阶段
        </button>
        <button
          type="button"
          onClick={() => onSelect({ kind: "attributes" })}
          className={navItemClass(isActive(section, { kind: "attributes" }))}
        >
          属性
        </button>
      </div>

      {schema.tabs.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="px-2.5 py-1 font-(family-name:--font-mono) text-[11px] tracking-[0.04em] text-(--muted-2)">Tab</span>
          {schema.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect({ kind: "tab", tabId: tab.id })}
              className={navItemClass(isActive(section, { kind: "tab", tabId: tab.id }))}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

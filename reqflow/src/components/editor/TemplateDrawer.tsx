import { BODY_TEMPLATES } from "../../lib/templates";

interface TemplateDrawerProps {
  onInsert: (markdown: string) => void;
}

function TemplateIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 20 20" fill="none">
      <path d="M4 4h6l6 6-6 6-6-6V4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function TemplateDrawer({ onInsert }: TemplateDrawerProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="正文模板"
        title="正文模板"
        className="grid size-6.5 place-items-center rounded-full border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) text-(--module-scope-text-tertiary) hover:border-(--module-scope-action-base) hover:text-(--module-scope-action-strong)"
      >
        <TemplateIcon />
      </button>
      <div className="pointer-events-none absolute top-[30px] right-0 z-10 w-65 rounded-(--r-lg) border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) p-2 opacity-0 shadow-(--shadow-floating) transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="px-1.5 pt-1 pb-1.5 text-[11px] text-(--module-scope-text-tertiary)">正文模板</div>
        <div className="flex flex-col gap-0.5">
          {BODY_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onInsert(template.markdown)}
              className="w-full truncate rounded-(--r-sm) px-2 py-1.5 text-left text-[12.5px] text-(--module-scope-text-primary) hover:bg-(--module-scope-background-elevated)"
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

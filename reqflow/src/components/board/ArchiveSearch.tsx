function SearchIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M17 17l-3.6-3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface ArchiveSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function ArchiveSearch({ value, onChange }: ArchiveSearchProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex flex-none items-center gap-1.5 rounded-(--r-sm) border border-(--border) bg-(--surface-2) px-2 py-0.75"
    >
      <span className="flex-none text-(--muted-2)">
        <SearchIcon />
      </span>
      <input
        type="text"
        placeholder="搜索归档需求…"
        aria-label="搜索归档需求"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-37.5 border-none bg-transparent text-[12px] text-(--fg) outline-none placeholder:text-(--muted-2)"
      />
    </div>
  );
}

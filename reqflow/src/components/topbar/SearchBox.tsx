import { useEffect, useRef, useState } from "react";
import type { Requirement } from "../../types/models";
import { STAGE_LABEL } from "../detail/tabs/activityShared";

function SearchIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M17 17l-3.6-3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface SearchBoxProps {
  requirements: Requirement[];
  onJumpToRequirement: (id: string) => void;
}

export function SearchBox({ requirements, onJumpToRequirement }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const trimmed = query.trim().toLowerCase();
  const matches = trimmed ? requirements.filter((r) => r.name.toLowerCase().includes(trimmed)) : [];

  function jump(id: string) {
    onJumpToRequirement(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="absolute top-1/2 left-1/2 w-[380px] max-w-[40vw] -translate-x-1/2 -translate-y-1/2">
      <div className="relative flex w-full items-center gap-1.5 rounded-(--r-md) border border-(--border) bg-(--surface) px-2.5 py-[5px] focus-within:border-(--accent)">
        <span className="flex-none text-(--muted-2)">
          <SearchIcon />
        </span>
        <input
          type="text"
          placeholder="搜索需求名称…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="min-w-0 flex-1 border-none bg-transparent font-(family-name:--font-body) text-[12.5px] text-(--fg) outline-none placeholder:text-(--muted-2)"
        />
      </div>

      {open && trimmed && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 max-h-80 w-full overflow-y-auto rounded-(--r-md) border border-(--border-strong) bg-(--surface) p-1.25 shadow-[0_12px_32px_-8px_rgba(30,40,70,0.18),0_2px_8px_rgba(30,40,70,0.05)]">
          {matches.length === 0 ? (
            <div className="p-5 text-center text-[12.5px] text-(--muted-2)">没有匹配的需求</div>
          ) : (
            matches.map((r) => (
              <div
                key={r.id}
                onClick={() => jump(r.id)}
                className="flex cursor-pointer items-center gap-2 rounded-(--r-sm) px-2.25 py-1.75 text-[13px] text-(--fg) hover:bg-(--surface-2)"
              >
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{r.name}</span>
                <span className="flex-none font-(family-name:--font-mono) text-[11px] text-(--muted-2)">{STAGE_LABEL[r.stage]}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

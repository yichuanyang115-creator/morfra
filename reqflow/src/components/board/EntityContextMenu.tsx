import { useEffect, useRef } from "react";

interface EntityContextMenuProps {
  position: { x: number; y: number };
  onDelete: () => void;
  onClose: () => void;
}

export function EntityContextMenu({ position, onDelete, onClose }: EntityContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={menuRef} role="menu" aria-label="实体操作菜单" style={{ left: position.x, top: position.y }} className="fixed z-50 w-30 rounded-(--r-md) border border-(--border) bg-(--surface) p-1 [box-shadow:var(--shadow-floating)]">
      <button type="button" role="menuitem" onClick={onDelete} className="w-full rounded-(--r-sm) px-2 py-1.5 text-left text-[12px] text-(--context-strong) hover:bg-(--st-blocked-soft) hover:text-(--st-blocked)">
        永久删除
      </button>
    </div>
  );
}

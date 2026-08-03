import { useEffect, useRef } from "react";

interface ColumnContextMenuProps {
  /** 触发右键的鼠标坐标，用于定位菜单（fixed 定位，不受父级 overflow 裁切）。 */
  position: { x: number; y: number };
  onEdit: () => void;
  onClose: () => void;
}

/**
 * 看板表头右键菜单。本 Phase（18）只接"编辑此属性"跳转设置页一项，
 * Phase 19 会补齐"隐藏此属性"/"冻结至此列"两项（见 DEV-PLAN Phase 19）。
 */
export function ColumnContextMenu({ position, onEdit, onClose }: ColumnContextMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      style={{ top: position.y, left: position.x }}
      className="fixed z-50 w-40 rounded-(--r-lg) border border-(--border-strong) bg-(--surface) p-1.25 shadow-[0_12px_32px_-8px_rgba(30,40,70,0.18),0_2px_8px_rgba(30,40,70,0.05)]"
    >
      <button
        type="button"
        onClick={onEdit}
        className="w-full rounded-(--r-sm) border-none bg-transparent px-2.25 py-1.75 text-left text-[13px] text-(--fg) hover:bg-(--surface-2)"
      >
        编辑此属性
      </button>
    </div>
  );
}

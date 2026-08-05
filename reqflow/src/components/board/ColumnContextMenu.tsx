import { useEffect, useRef } from "react";

interface ColumnContextMenuProps {
  /** 触发右键的鼠标坐标，用于定位菜单（fixed 定位，不受父级 overflow 裁切）。 */
  position: { x: number; y: number };
  /**
   * 是否显示"冻结至此列"（讨论稿 §8.2：仅当该列左侧的属性列已全部冻结时出现）。
   * 由调用方按 frozenCount === 该列索引 判断，见 BoardHeader.tsx。
   */
  canFreeze: boolean;
  /**
   * 隐藏此属性：调 updateAttribute(id, { showOnBoard: false })。与设置页/字段面板的
   * 眼睛图标共用同一个 showOnBoard 标志位（联动），可随时在设置页恢复显示。
   */
  onHide: () => void;
  /** 冻结至此列：把冻结范围扩展到本列（setFrozenCount(索引 + 1)），写 viewPreferences。 */
  onFreeze: () => void;
  onEdit: () => void;
  onClose: () => void;
}

/**
 * 看板表头右键菜单（REQ-001 MUST"右键表头菜单：隐藏此属性 / 冻结至此列 / 编辑此属性"）。
 * 注意存储位置：隐藏写的是属性自身的 showOnBoard 字段（Phase 18 眼睛图标沿用的既有位置，
 * 看板隐藏与设置页眼睛图标联动）；冻结写 viewPreferences.frozenCount（不动 Schema）。
 * 两者都可逆，编辑跳转 Schema 设置页。
 */
export function ColumnContextMenu({ position, canFreeze, onHide, onFreeze, onEdit, onClose }: ColumnContextMenuProps) {
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

  const itemClass =
    "w-full rounded-(--r-sm) border-none bg-transparent px-2.25 py-1.75 text-left text-[13px] text-(--fg) hover:bg-(--surface-2)";

  return (
    <div
      ref={rootRef}
      style={{ top: position.y, left: position.x }}
      className="fixed z-50 w-40 rounded-(--r-lg) border border-(--border-strong) bg-(--surface) p-1.25 shadow-[0_12px_32px_-8px_rgba(30,40,70,0.18),0_2px_8px_rgba(30,40,70,0.05)]"
    >
      <button type="button" onClick={onHide} className={itemClass}>
        隐藏此属性
      </button>
      {canFreeze && (
        <button type="button" onClick={onFreeze} className={itemClass}>
          冻结至此列
        </button>
      )}
      <div className="my-1 h-px bg-(--border)" />
      <button type="button" onClick={onEdit} className={itemClass}>
        编辑此属性
      </button>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { TableSummary } from "../../types/domain";
import { TableEmojiPicker } from "./TableEmojiPicker";

const MENU_WIDTH = 180;
const PICKER_WIDTH = 304;
const ESTIMATED_HEIGHT = 164;
const GAP = 4;
const PADDING = 8;

export interface OpenTableMenu {
  table: TableSummary;
  anchor: HTMLButtonElement;
}

function positionMenu(anchor: HTMLButtonElement, width: number, height = ESTIMATED_HEIGHT) {
  const rect = anchor.getBoundingClientRect();
  const left = Math.min(Math.max(rect.right - width, PADDING), Math.max(PADDING, window.innerWidth - width - PADDING));
  const below = rect.bottom + GAP;
  const top = below + height <= window.innerHeight - PADDING ? below : Math.max(PADDING, rect.top - height - GAP);
  return { left, top };
}

interface Props {
  openMenu: OpenTableMenu;
  onRename: () => void;
  onDelete: () => void;
  onEmojiChange: (emoji: string) => void;
  onClose: (restoreFocus: boolean) => void;
}

export function TableActionsMenu({ openMenu, onRename, onDelete, onEmojiChange, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [choosingEmoji, setChoosingEmoji] = useState(false);
  const width = choosingEmoji ? PICKER_WIDTH : MENU_WIDTH;
  const [position, setPosition] = useState(() => positionMenu(openMenu.anchor, MENU_WIDTH));

  useLayoutEffect(() => {
    const height = menuRef.current?.getBoundingClientRect().height || ESTIMATED_HEIGHT;
    setPosition(positionMenu(openMenu.anchor, width, height));
    if (!choosingEmoji) menuRef.current?.querySelector<HTMLButtonElement>("[role^='menuitem']")?.focus();
  }, [choosingEmoji, openMenu, width]);

  useEffect(() => {
    const update = () => setPosition(positionMenu(openMenu.anchor, width, menuRef.current?.getBoundingClientRect().height || ESTIMATED_HEIGHT));
    const pointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !openMenu.anchor.contains(target)) onClose(true);
    };
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose(true);
      }
    };
    window.addEventListener("pointerdown", pointer);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("pointerdown", pointer);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [onClose, openMenu, width]);

  function handleKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (choosingEmoji) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role^='menuitem']") ?? []);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return createPortal(<div ref={menuRef} role="menu" aria-label={`${openMenu.table.name}的表操作`} className={`morfra-table-actions-menu${choosingEmoji ? " is-emoji-picker" : ""}`} style={{ ...position, width }} onKeyDown={handleKeys}>
    {choosingEmoji ? <>
      <button type="button" role="menuitem" className="morfra-table-menu-back" onClick={() => setChoosingEmoji(false)}>‹ 返回</button>
      <TableEmojiPicker currentEmoji={openMenu.table.emoji} onSelect={onEmojiChange} />
    </> : <>
      <button type="button" role="menuitem" onClick={onRename}>重命名</button>
      <button type="button" role="menuitem" onClick={() => setChoosingEmoji(true)}>更换 Emoji<span aria-hidden="true">›</span></button>
      <button type="button" role="menuitem" className="is-danger" onClick={onDelete}>删除</button>
    </>}
  </div>, document.body);
}

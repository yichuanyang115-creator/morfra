import { useEffect } from "react";
import { undoStack } from "../lib/undoStack";

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target.tagName));
}

/** 全局监听 Cmd/Ctrl+Z；焦点在编辑控件时保留原生草稿撤销，避免误撤销已保存数据。 */
export function useUndoKeyboard(onUndone: (summary: string) => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey && !isEditableTarget(event.target)) {
        event.preventDefault();
        void undoStack.undo().then((summary) => {
          if (summary) onUndone(summary);
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onUndone]);
}

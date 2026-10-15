import { clampPoint, moveActive, type GridSelection } from "./selectionModel";

export type GridDirection = "left" | "right" | "up" | "down";

export function moveSelection(selection: GridSelection, direction: GridDirection, rowCount: number, columnCount: number, extend = false): GridSelection {
  const delta = direction === "left" ? { row: 0, column: -1 } : direction === "right" ? { row: 0, column: 1 } : direction === "up" ? { row: -1, column: 0 } : { row: 1, column: 0 };
  return moveActive(selection, clampPoint({ row: selection.active.row + delta.row, column: selection.active.column + delta.column }, rowCount, columnCount), extend);
}

export function directionForKey(key: string, shift: boolean, editing: boolean): GridDirection | null {
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  if (key === "Tab") return shift ? "left" : "right";
  if (editing && key === "Enter") return shift ? "up" : "down";
  return null;
}

export function isPrintableKey(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">): boolean {
  return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
}

import type { ColumnLayout } from "../../lib/table/columnLayout";
import { ROW_NUMBER_WIDTH } from "../../lib/table/columnLayout";
import { rangeBounds, type GridSelection } from "../../lib/table/selectionModel";

interface GridSelectionLayerProps {
  selection: GridSelection | null;
  layouts: ColumnLayout[];
  rowHeight: number;
  rowTops?: number[];
  frozenBoundaryWidth: number;
  scrollLeft: number;
}

export function GridSelectionLayer({ selection, layouts, rowHeight, rowTops, frozenBoundaryWidth, scrollLeft }: GridSelectionLayerProps) {
  if (!selection || selection.rows.length > 0) return null;
  const bounds = rangeBounds(selection.range);
  const left = ROW_NUMBER_WIDTH + layouts.slice(0, bounds.left).reduce((total, layout) => total + layout.width, 0);
  const width = layouts.slice(bounds.left, bounds.right + 1).reduce((total, layout) => total + layout.width, 0);
  const top = rowTops?.[bounds.top] ?? bounds.top * rowHeight;
  const bottom = (rowTops?.[bounds.bottom] ?? bounds.bottom * rowHeight) + rowHeight;
  const clippedWidth = Math.max(0, frozenBoundaryWidth + scrollLeft - left);
  return <div className="morfra-grid-selection-layer" aria-hidden="true" style={{ left, top, width, height: bottom - top, clipPath: clippedWidth ? `inset(0 0 0 ${Math.min(width, clippedWidth)}px)` : undefined }} />;
}

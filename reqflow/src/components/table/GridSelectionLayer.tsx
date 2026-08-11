import type { ColumnLayout } from "../../lib/table/columnLayout";
import { ROW_NUMBER_WIDTH } from "../../lib/table/columnLayout";
import { rangeBounds, type GridSelection } from "../../lib/table/selectionModel";

interface GridSelectionLayerProps {
  selection: GridSelection | null;
  layouts: ColumnLayout[];
  rowHeight: number;
}

export function GridSelectionLayer({ selection, layouts, rowHeight }: GridSelectionLayerProps) {
  if (!selection || selection.rows.length > 0) return null;
  const bounds = rangeBounds(selection.range);
  const left = ROW_NUMBER_WIDTH + layouts.slice(0, bounds.left).reduce((total, layout) => total + layout.width, 0);
  const width = layouts.slice(bounds.left, bounds.right + 1).reduce((total, layout) => total + layout.width, 0);
  return <div className="morfra-grid-selection-layer" aria-hidden="true" style={{ left, top: bounds.top * rowHeight, width, height: (bounds.bottom - bounds.top + 1) * rowHeight }} />;
}

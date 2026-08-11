import type { JsonValue, RecordData } from "../../types/domain";
import type { EditingCell } from "../../stores/gridInteractionStore";
import { buildColumnLayouts, stickyOffset } from "../../lib/table/columnLayout";
import type { GridDirection } from "../../lib/table/keyboardNavigation";
import { CellEditorHost } from "./editors/CellEditorHost";

interface GridPersistentEditorProps {
  editing: EditingCell | null;
  layouts: ReturnType<typeof buildColumnLayouts>;
  records: RecordData[];
  rowHeight: number;
  scrollLeft: number;
  error: string | null;
  rowTops?: number[];
  onChange: (value: JsonValue) => void;
  onCommit: (direction?: GridDirection) => void;
  onCancel: () => void;
}

export function GridPersistentEditor({ editing, layouts, records, rowHeight, scrollLeft, error, rowTops, onChange, onCommit, onCancel }: GridPersistentEditorProps) {
  if (!editing) return null;
  const column = layouts.findIndex((layout) => layout.field.id === editing.fieldId);
  const field = layouts[column]?.field;
  const record = records.find((item) => item.id === editing.recordId);
  if (!field || !record) return null;
  const contentLeft = 68 + layouts.slice(0, column).reduce((sum, layout) => sum + layout.width, 0);
  const left = layouts[column]?.frozen ? scrollLeft + stickyOffset(layouts, field.id) : contentLeft;
  return <div className={`morfra-grid-persistent-editor ${error ? "has-error" : ""}`} style={{ left, top: 64 + (rowTops?.[editing.point.row] ?? editing.point.row * rowHeight), width: layouts[column]?.width, height: rowHeight }}>
    <CellEditorHost field={field} value={editing.draft} label={`编辑第 ${editing.point.row + 1} 行${field.name}`} error={error} onChange={onChange} onCommit={onCommit} onCancel={onCancel} />
    {error && <span className="morfra-grid-editor-error-icon" role="img" aria-label="输入错误">!</span>}
  </div>;
}

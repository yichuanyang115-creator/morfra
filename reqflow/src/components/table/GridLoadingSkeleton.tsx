import type { GridLayoutConfig } from "./DataGrid";

export function GridLoadingSkeleton({ config }: { config: GridLayoutConfig }) {
  const fieldIds = config.fieldIds.length ? config.fieldIds : ["title"];
  const gridTemplateColumns = `68px ${fieldIds.map((fieldId) => `${config.columnWidths[fieldId] ?? (fieldId === fieldIds[0] ? 240 : 160)}px`).join(" ")}`;
  const cells = Array.from({ length: fieldIds.length + 1 });
  return <section className="morfra-data-grid morfra-data-grid-skeleton" aria-label="正在读取表格数据" aria-busy="true">
    <div className="morfra-grid-controls"><span>正在读取表格</span></div>
    <div className="morfra-grid-skeleton-header" data-testid="grid-skeleton-header" style={{ gridTemplateColumns }}>{cells.map((_, index) => <span key={index} />)}</div>
    <div className="morfra-grid-skeleton-rows">{Array.from({ length: 7 }, (_, rowIndex) => <div key={rowIndex} style={{ gridTemplateColumns, minHeight: config.rowHeight }}>{cells.map((_, columnIndex) => <span key={columnIndex} />)}</div>)}</div>
  </section>;
}

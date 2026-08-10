import { fireEvent, render, screen } from "@testing-library/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldSummary, RecordData, TableDataSnapshot } from "../../types/domain";
import { DataGrid, type GridLayoutConfig } from "./DataGrid";

vi.mock("@tanstack/react-virtual", () => ({ useVirtualizer: vi.fn() }));

function virtualItem(index: number, start: number) { return { index, start }; }

const fields: FieldSummary[] = Array.from({ length: 200 }, (_, index) => ({ id: `field-${index}`, tableId: "table-1", groupId: null, name: `字段 ${index}`, fieldType: "text", isTitle: index === 0, position: index, config: {}, options: [] }));
const records: RecordData[] = Array.from({ length: 10_000 }, (_, index) => ({ id: `record-${index}`, tableId: "table-1", position: index, autoNumber: index + 1, createdAt: "", updatedAt: "", values: { "field-199": index === 9_999 ? "x".repeat(60) : "短文本" }, multiSelectValues: {} }));
const data: TableDataSnapshot = { tableId: "table-1", groups: [], fields, records };
const config: GridLayoutConfig = { fieldIds: fields.map((field) => field.id), groupOrder: [], columnWidths: {}, frozenFieldId: null, rowHeight: 40, collapsedGroupIds: [] };

describe("DataGrid 虚拟化与自动适配", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.mocked(useVirtualizer).mockImplementation(((options: { horizontal?: boolean }) => ({
      getTotalSize: () => options.horizontal ? 40_000 : 400_000,
      getVirtualItems: () => options.horizontal ? [virtualItem(0, 0), virtualItem(199, 39_800)] : [virtualItem(9_998, 399_920), virtualItem(9_999, 399_960)],
    })) as never);
  });

  it("10,000×200 画布只挂载虚拟窗口单元格，并以当前可见后段记录自动适配", () => {
    const onConfigChange = vi.fn();
    const { container } = render(<DataGrid data={data} config={config} onConfigChange={onConfigChange} onCreate={vi.fn()} onOpenDetail={vi.fn()} />);

    expect(vi.mocked(useVirtualizer)).toHaveBeenCalledWith(expect.objectContaining({ count: 10_000, overscan: 4 }));
    expect(vi.mocked(useVirtualizer)).toHaveBeenCalledWith(expect.objectContaining({ count: 200, horizontal: true, overscan: 3 }));
    expect(container.querySelectorAll(".morfra-grid-cell")).toHaveLength(4);

    fireEvent.doubleClick(screen.getByRole("button", { name: "调整 字段 199 列宽" }));
    expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({ columnWidths: expect.objectContaining({ "field-199": 528 }) }));
  });
});

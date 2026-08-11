import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FieldSummary, RecordData } from "../../types/domain";
import { GridCell } from "./GridCell";

const record: RecordData = { id: "record", tableId: "table", position: 0, autoNumber: 1, createdAt: "2026-08-11T09:30:00Z", updatedAt: "2026-08-11T10:30:00Z", values: { amount: 1234 }, multiSelectValues: {} };
const field = (fieldType: FieldSummary["fieldType"], config: FieldSummary["config"] = {}): FieldSummary => ({ id: fieldType === "number" ? "amount" : fieldType, tableId: "table", groupId: null, name: "字段", fieldType, isTitle: false, position: 0, config, options: [] });

function renderCell(target: FieldSummary) {
  render(<GridCell id="cell" field={target} record={record} point={{ row: 0, column: 0 }} selected={false} active={false} editing={false} readOnly={false} onPointerDown={vi.fn()} onPointerEnter={vi.fn()} onDoubleClick={vi.fn()} onContextMenu={vi.fn()} onToggleCheckbox={vi.fn()} />);
}

describe("GridCell user-readable formatting", () => {
  it("renders configured number formats instead of raw values", () => {
    renderCell(field("number", { format: "percent" }));
    expect(screen.getByText("1,234%")).toBeInTheDocument();
  });

  it("renders system timestamps with the shared date-time formatter", () => {
    renderCell(field("created_time"));
    expect(screen.getByRole("gridcell").textContent).not.toContain("2026-08-11T09:30:00Z");
  });
});

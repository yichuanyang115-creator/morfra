import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecordTable } from "./RecordTable";
import type { TableDataSnapshot } from "../../types/domain";

const emptyData: TableDataSnapshot = {
  tableId: "table-1",
  groups: [],
  fields: [{ id: "title", tableId: "table-1", groupId: null, name: "标题", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] }],
  records: [],
};

describe("RecordTable", () => {
  it("shows a real empty state and exposes the record creation action", () => {
    render(<RecordTable data={emptyData} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("还没有记录，点击“新建记录”开始录入。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建记录" })).toBeEnabled();
  });
});

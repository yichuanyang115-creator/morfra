import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KanbanView } from "./KanbanView";
import { EMPTY_VIEW_PIPELINE } from "../../lib/table/viewPipeline";
import type { TableDataSnapshot } from "../../types/domain";

const data: TableDataSnapshot = {
  tableId: "table", groups: [],
  fields: [
    { id: "title", tableId: "table", groupId: null, name: "标题", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
    { id: "status", tableId: "table", groupId: null, name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [{ id: "todo", fieldId: "status", name: "待办", color: "blue", position: 0 }, { id: "done", fieldId: "status", name: "完成", color: "green", position: 1 }] },
  ],
  records: [{ id: "record", tableId: "table", position: 0, autoNumber: 1, createdAt: "1", updatedAt: "1", values: { title: "写测试", status: "todo" }, multiSelectValues: {} }],
};

describe("KanbanView", () => {
  it("renders option columns, the empty column, and the unique record count", () => {
    render(<KanbanView data={data} records={data.records} config={{ groupFieldId: "status", fieldIds: [], columnOrder: [], collapsedKeys: [], cardPositions: {} }} pipeline={EMPTY_VIEW_PIPELINE} onConfigChange={vi.fn()} onCreate={vi.fn()} onUpdate={vi.fn()} onMove={vi.fn()} onDelete={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByText("待办")).toBeInTheDocument();
    expect(screen.getByText("完成")).toBeInTheDocument();
    expect(screen.getByText("未分组")).toBeInTheDocument();
    expect(screen.getByText("1 条记录")).toBeInTheDocument();
  });

  it("persists a collapsed column state", () => {
    const onConfigChange = vi.fn();
    render(<KanbanView data={data} records={data.records} config={{ groupFieldId: "status", fieldIds: [], columnOrder: [], collapsedKeys: [], cardPositions: {} }} pipeline={EMPTY_VIEW_PIPELINE} onConfigChange={onConfigChange} onCreate={vi.fn()} onUpdate={vi.fn()} onMove={vi.fn()} onDelete={vi.fn()} onOpenDetail={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "折叠待办" }));
    expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ collapsedKeys: ["todo"] }));
  });

  it("compacts a collapsed column and moves following tracks left", () => {
    const { container } = render(<KanbanView data={data} records={data.records} config={{ groupFieldId: "status", fieldIds: [], columnOrder: [], collapsedKeys: ["todo"], cardPositions: {} }} pipeline={EMPTY_VIEW_PIPELINE} onConfigChange={vi.fn()} onCreate={vi.fn()} onUpdate={vi.fn()} onMove={vi.fn()} onDelete={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByText("待办").closest("article")).toHaveStyle({ width: "44px", left: "0px" });
    expect(screen.getByText("完成").closest("article")).toHaveStyle({ width: "272px", left: "54px" });
    expect(container.querySelector(".morfra-kanban-columns")).toHaveStyle({ width: "618px" });
  });

  it("saves a card at the exact drop position through the atomic move callback", async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const onUndo = vi.fn().mockResolvedValue(undefined);
    const records = [...data.records, { ...data.records[0], id: "record-2", position: 1, values: { title: "第二条", status: "todo" } }];
    render(<KanbanView data={{ ...data, records }} records={records} config={{ groupFieldId: "status", fieldIds: [], columnOrder: [], collapsedKeys: [], cardPositions: {} }} pipeline={EMPTY_VIEW_PIPELINE} onConfigChange={vi.fn()} onCreate={vi.fn()} onUpdate={vi.fn()} onMove={onMove} onDelete={vi.fn()} onUndo={onUndo} onOpenDetail={vi.fn()} />);
    fireEvent.dragStart(screen.getByRole("button", { name: "第二条" }));
    fireEvent.drop(screen.getByRole("button", { name: "写测试" }));
    await waitFor(() => expect(onMove).toHaveBeenCalledWith("record-2", "status", "todo", expect.objectContaining({ cardPositions: { todo: ["record-2", "record"] } })));
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    await waitFor(() => expect(onUndo).toHaveBeenCalledOnce());
  });

  it("allows a sorted card to cross columns without writing a new manual position", async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const config = { groupFieldId: "status", fieldIds: [], columnOrder: [], collapsedKeys: [], cardPositions: { todo: ["record"] } };
    render(<KanbanView data={data} records={data.records} config={config} pipeline={{ ...EMPTY_VIEW_PIPELINE, sorts: [{ id: "title-sort", fieldId: "title", direction: "asc" }] }} onConfigChange={vi.fn()} onCreate={vi.fn()} onUpdate={vi.fn()} onMove={onMove} onDelete={vi.fn()} onOpenDetail={vi.fn()} />);
    fireEvent.dragStart(screen.getByRole("button", { name: "写测试" }));
    fireEvent.drop(screen.getByText("完成").closest("article")!);
    await waitFor(() => expect(onMove).toHaveBeenCalledWith("record", "status", "done", expect.objectContaining({ cardPositions: { todo: ["record"] } })));
  });

  it("windows 10,000 dynamic columns instead of mounting every column or card", () => {
    const bucket = { id: "bucket", tableId: "table", groupId: null, name: "分组", fieldType: "text" as const, isTitle: false, position: 2, config: {}, options: [] };
    const records = Array.from({ length: 10_000 }, (_, index) => ({
      ...data.records[0], id: `record-${index}`, position: index, values: { title: `记录 ${index}`, status: "todo", bucket: `分组 ${index}` },
    }));
    const props = { onConfigChange: vi.fn(), onCreate: vi.fn(), onUpdate: vi.fn(), onMove: vi.fn(), onDelete: vi.fn(), onOpenDetail: vi.fn() };
    const { container, rerender } = render(<KanbanView data={{ ...data, fields: [...data.fields, bucket], records }} records={records} config={{ groupFieldId: "bucket", fieldIds: [], columnOrder: [], collapsedKeys: [], cardPositions: {} }} pipeline={EMPTY_VIEW_PIPELINE} {...props} />);
    expect(screen.getByText("10000 条记录")).toBeInTheDocument();
    expect(container.querySelectorAll(".morfra-kanban-column").length).toBeLessThanOrEqual(6);
    expect(container.querySelectorAll(".morfra-kanban-card").length).toBeLessThanOrEqual(6);
    rerender(<KanbanView data={{ ...data, records }} records={records} config={{ groupFieldId: "status", fieldIds: [], columnOrder: [], collapsedKeys: [], cardPositions: {} }} pipeline={EMPTY_VIEW_PIPELINE} {...props} />);
    expect(container.querySelectorAll(".morfra-kanban-card").length).toBeLessThanOrEqual(12);
  });
});

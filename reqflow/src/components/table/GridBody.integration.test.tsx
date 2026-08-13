import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldSummary, RecordData } from "../../types/domain";
import type { ColumnLayout } from "../../lib/table/columnLayout";
import { GridBody } from "./GridBody";

const RECT = { bottom: 160, height: 160, left: 0, right: 360, top: 0, width: 360, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe() { queueMicrotask(() => this.callback([{ contentRect: RECT }] as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver)); }
  disconnect() {}
  unobserve() {}
}

const fields: FieldSummary[] = Array.from({ length: 200 }, (_, index) => ({ id: `field-${index}`, tableId: "table-1", groupId: null, name: `字段 ${index}`, fieldType: "text", isTitle: index === 0, position: index, config: {}, options: [] }));
const layouts: ColumnLayout[] = fields.map((field) => ({ field, width: 120, frozen: field.isTitle }));
const records: RecordData[] = Array.from({ length: 10_000 }, (_, index) => ({ id: `record-${index}`, tableId: "table-1", position: index, autoNumber: index + 1, createdAt: "", updatedAt: "", values: {}, multiSelectValues: {} }));

function GridHarness() {
  const parentRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const setScrollElement = useCallback((element: HTMLDivElement | null) => {
    parentRef.current = element;
    if (!element) return;
    Object.defineProperties(element, { clientHeight: { configurable: true, value: 160 }, clientWidth: { configurable: true, value: 360 }, offsetHeight: { configurable: true, value: 160 }, offsetWidth: { configurable: true, value: 360 } });
    element.getBoundingClientRect = () => RECT;
    setReady(true);
  }, []);
  return <div ref={setScrollElement} data-testid="grid-scroll" style={{ height: 160, overflow: "auto", width: 360 }}>{ready && <GridBody gridId="test-grid" parentRef={parentRef} layouts={layouts} records={records} rowHeight={40} selection={null} editing={null} onOpenDetail={vi.fn()} onRenderedRecordsChange={vi.fn()} onSelectCell={vi.fn()} onExtendSelection={vi.fn()} onSelectRows={vi.fn()} onStartEditing={vi.fn()} onContextCell={vi.fn()} onToggleCheckbox={vi.fn()} />}</div>;
}

function GroupedGridHarness({ onMove = vi.fn(), onReorder = vi.fn(), sameGroup = false, allowCreate = true }: { onMove?: (recordId: string, sourceKey: string, targetKey: string) => void; onReorder?: (recordId: string, targetRecordId: string) => void; sameGroup?: boolean; allowCreate?: boolean }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const setScrollElement = useCallback((element: HTMLDivElement | null) => { parentRef.current = element; if (!element) return; Object.defineProperties(element, { clientHeight: { configurable: true, value: 320 }, clientWidth: { configurable: true, value: 360 }, offsetHeight: { configurable: true, value: 320 }, offsetWidth: { configurable: true, value: 360 } }); element.getBoundingClientRect = () => ({ ...RECT, height: 320, bottom: 320 }); setReady(true); }, []);
  const groupedRecords = records.slice(0, 2);
  const recordGroups = sameGroup ? [{ key: "todo", label: "待办", count: 2, first: true, last: false }, { key: "todo", label: "待办", count: 2, first: false, last: true }] : [{ key: "todo", label: "待办", count: 1, first: true, last: true }, { key: "done", label: "完成", count: 1, first: true, last: true }];
  return <div ref={setScrollElement} style={{ height: 320, overflow: "auto", width: 360 }}>{ready && <GridBody gridId="grouped-grid" parentRef={parentRef} layouts={layouts.slice(0, 2)} records={groupedRecords} recordGroups={recordGroups} emptyGroups={[{ key: "blocked", label: "阻塞", count: 0, recordIds: [] }]} rowHeight={40} selection={null} editing={null} onOpenDetail={vi.fn()} onRenderedRecordsChange={vi.fn()} onSelectCell={vi.fn()} onExtendSelection={vi.fn()} onSelectRows={vi.fn()} onStartEditing={vi.fn()} onContextCell={vi.fn()} onToggleCheckbox={vi.fn()} canMoveGroups canReorderRows onMoveToGroup={onMove} onReorderWithinGroup={onReorder} onCreateInGroup={allowCreate ? vi.fn() : undefined} />}</div>;
}

function renderedIndexes(container: HTMLElement, attribute: "data-row-index" | "data-column-index") { return Array.from(container.querySelectorAll(`[${attribute}]`)).map((node) => Number(node.getAttribute(attribute))); }

describe("GridBody 真实滚动虚拟化", () => {
  beforeEach(() => { vi.stubGlobal("ResizeObserver", ResizeObserverMock); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("滚动后切换到后段行列，且 10,000×200 仍只保留有限 DOM", async () => {
    const { container, getByTestId } = render(<GridHarness />);
    const scroll = getByTestId("grid-scroll");
    await waitFor(() => expect(renderedIndexes(container, "data-row-index").length).toBeGreaterThan(0));
    const initialRows = renderedIndexes(container, "data-row-index");
    const initialColumns = renderedIndexes(container, "data-column-index");

    act(() => { scroll.scrollTop = 360_000; scroll.scrollLeft = 18_000; scroll.dispatchEvent(new Event("scroll")); });

    await waitFor(() => expect(Math.min(...renderedIndexes(container, "data-row-index"))).toBeGreaterThan(Math.max(...initialRows)));
    await waitFor(() => expect(Math.max(...renderedIndexes(container, "data-column-index"))).toBeGreaterThan(Math.max(...initialColumns)));
    expect(container.querySelectorAll(".morfra-grid-cell").length).toBeLessThan(400);
  });

  it("记录行使用与表头一致的显式单行列轨道", async () => {
    const { container } = render(<GridHarness />);
    await waitFor(() => expect(renderedIndexes(container, "data-row-index").length).toBeGreaterThan(0));
    const row = container.querySelector(".morfra-grid-record-row") as HTMLElement;
    expect(row.style.gridTemplateColumns).toMatch(/^48px(?: 120px){200}$/);
    expect(row.querySelector(".morfra-grid-row-number")?.parentElement).toBe(row);
  });

  it("在虚拟表格行流中渲染组头、组内投影和组尾新增入口", async () => {
    const { getByText, getAllByText, getByRole } = render(<GroupedGridHarness />);
    await waitFor(() => expect(getByText("待办")).toBeTruthy());
    expect(getAllByText("1 条记录")).toHaveLength(2);
    expect(getByRole("button", { name: "＋ 在“待办”中新建记录" })).toBeTruthy();
    expect(getByText("阻塞")).toBeTruthy();
    expect(getByText("0 条记录")).toBeTruthy();
  });

  it("拖到另一组时只发出一次跨组移动命令", async () => {
    const onMove = vi.fn();
    const { getByText, getByRole } = render(<GroupedGridHarness onMove={onMove} />);
    await waitFor(() => expect(getByText("完成")).toBeTruthy());
    fireEvent.dragStart(getByRole("button", { name: "拖动第 1 条记录" }));
    fireEvent.dragOver(getByText("完成").parentElement as Element);
    fireEvent.drop(getByText("完成").parentElement as Element);
    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove).toHaveBeenCalledWith("record-0", "todo", "done");
  });

  it("无显式排序时，同组拖拽发出底层手动顺序命令", async () => {
    const onReorder = vi.fn();
    const { container, getByText, getByRole } = render(<GroupedGridHarness sameGroup onReorder={onReorder} />);
    await waitFor(() => expect(getByText("待办")).toBeTruthy());
    fireEvent.dragStart(getByRole("button", { name: "拖动第 1 条记录" }));
    fireEvent.dragOver(container.querySelector('.morfra-grid-row[data-row-index="1"]') as Element);
    fireEvent.drop(container.querySelector('.morfra-grid-row[data-row-index="1"]') as Element);
    expect(onReorder).toHaveBeenCalledWith("record-0", "record-1");
  });

  it("只读系统字段分组不渲染组内新增入口", async () => {
    const { queryByRole, getByText } = render(<GroupedGridHarness allowCreate={false} />);
    await waitFor(() => expect(getByText("待办")).toBeTruthy());
    expect(queryByRole("button", { name: /中新建记录/ })).toBeNull();
  });
});

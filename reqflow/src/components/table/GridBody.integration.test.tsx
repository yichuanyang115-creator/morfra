import { act, render, waitFor } from "@testing-library/react";
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
});

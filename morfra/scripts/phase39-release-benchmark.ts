import { cpus, release, type } from "node:os";
import { performance } from "node:perf_hooks";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { KanbanView } from "../src/components/board/KanbanView";
import { DataGrid } from "../src/components/table/DataGrid";
import { EMPTY_VIEW_PIPELINE, parseViewPipelineConfig, runViewPipeline, type ViewPipelineConfig } from "../src/lib/table/viewPipeline";
import type { FieldSummary, RecordData, TableDataSnapshot } from "../src/types/domain";

const visibleFields: FieldSummary[] = [
  { id: "title", tableId: "benchmark", groupId: null, name: "标题", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "status", tableId: "benchmark", groupId: null, name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [{ id: "todo", fieldId: "status", name: "待办", color: "blue", position: 0 }, { id: "done", fieldId: "status", name: "完成", color: "green", position: 1 }] },
  { id: "score", tableId: "benchmark", groupId: null, name: "分数", fieldType: "number", isTitle: false, position: 2, config: {}, options: [] },
  { id: "created", tableId: "benchmark", groupId: null, name: "创建时间", fieldType: "created_time", isTitle: false, position: 3, config: {}, options: [] },
];
const extraFields: FieldSummary[] = Array.from({ length: 196 }, (_, index) => ({ id: `extra-${index}`, tableId: "benchmark", groupId: null, name: `隐藏字段 ${index + 1}`, fieldType: "text" as const, isTitle: false, position: index + visibleFields.length, config: {}, options: [] }));
const fields = [...visibleFields, ...extraFields];
const extraValues = Object.fromEntries(extraFields.map((field) => [field.id, "普通内容"]));
const records: RecordData[] = Array.from({ length: 10_000 }, (_, index) => ({ id: `record-${index}`, tableId: "benchmark", position: index, autoNumber: index + 1, createdAt: `2026-08-${String(index % 28 + 1).padStart(2, "0")}T09:00:00Z`, updatedAt: "2026-08-11T09:00:00Z", values: { title: `需求记录 ${index}`, status: index % 2 ? "todo" : "done", score: index, ...extraValues }, multiSelectValues: {} }));
const data: TableDataSnapshot = { tableId: "benchmark", groups: [], fields, records };
const configs: Record<string, ViewPipelineConfig> = {
  search: EMPTY_VIEW_PIPELINE,
  filter: { ...EMPTY_VIEW_PIPELINE, filters: [{ id: "score", fieldId: "score", operator: "between", value: [2500, 7500] }] },
  sort: { ...EMPTY_VIEW_PIPELINE, sorts: [{ id: "score", fieldId: "score", direction: "desc" }, { id: "title", fieldId: "title", direction: "asc" }] },
  viewSwitch: { ...EMPTY_VIEW_PIPELINE, filters: [{ id: "status", fieldId: "status", operator: "equals", value: "todo" }], sorts: [{ id: "created", fieldId: "created", direction: "asc" }], group: { fieldId: "status", direction: "asc", collapsedKeys: [] }, conditionalColors: [{ id: "late", fieldId: "score", operator: "greaterThan", value: 8000, color: "red", enabled: true }] },
};

const WARMUP_RUNS = 5;
const MEASURED_RUNS = 30;
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
class BenchmarkResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) { this.callback([{ target, contentRect: { width: 1280, height: 720 } as DOMRectReadOnly }] as ResizeObserverEntry[], this as unknown as ResizeObserver); }
  disconnect() {}
  unobserve() {}
}
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, ResizeObserver: BenchmarkResizeObserver, requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0), cancelAnimationFrame: clearTimeout });
Object.defineProperties(dom.window.HTMLElement.prototype, {
  clientWidth: { configurable: true, get: () => 1280 },
  clientHeight: { configurable: true, get: () => 720 },
});

const gridConfig = { fieldIds: visibleFields.map((field) => field.id), groupOrder: ["ungrouped"], columnWidths: {}, frozenFieldId: "title", rowHeight: 40 as const, collapsedGroupIds: [], pipeline: EMPTY_VIEW_PIPELINE };
const boardConfig = { groupFieldId: "status", fieldIds: ["score", "created"], columnOrder: ["todo", "done"], collapsedKeys: [], cardPositions: {} };
const tableMount = document.createElement("div");
const boardMount = document.createElement("div");
document.body.append(tableMount, boardMount);
const tableRoot = createRoot(tableMount);
const boardRoot = createRoot(boardMount);

function renderTableViewport(recordsForView: RecordData[]): void {
  flushSync(() => tableRoot.render(createElement(DataGrid, { viewId: "benchmark-table", data: { ...data, records: recordsForView }, config: gridConfig, onConfigChange() {}, onOpenDetail() {}, onCreate() {}, onUpdateCell: async () => undefined })));
  if (!tableMount.querySelector(".morfra-data-grid [role='grid']")) throw new Error("DataGrid production viewport did not mount");
}

function renderBoardViewport(recordsForView: RecordData[]): void {
  flushSync(() => boardRoot.render(createElement(KanbanView, { data, records: recordsForView, config: boardConfig, pipeline: EMPTY_VIEW_PIPELINE, onConfigChange() {}, onCreate: async () => undefined, onUpdate: async () => undefined, onMove: async () => undefined, onDelete: async () => undefined, onOpenDetail() {} })));
  if (boardMount.querySelectorAll(".morfra-kanban-card").length === 0) throw new Error("KanbanView visible viewport did not render cards");
}

function runInteraction(name: string, config: ViewPipelineConfig, view: "table" | "board" = "table"): void {
  const parsed = name === "viewSwitch" ? parseViewPipelineConfig(JSON.parse(JSON.stringify(config))) : config;
  const result = runViewPipeline(data, parsed, name === "search" ? "需求 999" : "");
  if (view === "board") renderBoardViewport(result.records);
  else renderTableViewport(result.records);
}

const operations: Record<string, () => void> = {
  search: () => runInteraction("search", configs.search),
  filter: () => runInteraction("filter", configs.filter),
  sort: () => runInteraction("sort", configs.sort),
  viewSwitch: () => runInteraction("viewSwitch", configs.viewSwitch),
  tableViewportRender: () => runInteraction("tableViewportRender", configs.search),
  boardViewportRender: () => runInteraction("boardViewportRender", configs.viewSwitch, "board"),
};

function measure(operation: () => void): number[] {
  Array.from({ length: WARMUP_RUNS }, operation);
  return Array.from({ length: MEASURED_RUNS }, () => {
    const startedAt = performance.now();
    operation();
    return Number((performance.now() - startedAt).toFixed(2));
  });
}

function percentile95(samples: number[]): number {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1] ?? Number.NaN;
}

const samples = Object.fromEntries(Object.entries(operations).map(([name, operation]) => [name, measure(operation)]));
const p95Ms = Object.fromEntries(Object.entries(samples).map(([name, durations]) => [name, percentile95(durations)]));
const failed = Object.entries(p95Ms).filter(([, duration]) => duration > 300);
console.log(JSON.stringify({ build: "production-minified-Morfra-components", componentHarness: "JSDOM production React mount with real DataGrid/KanbanView virtual viewports", machine: { model: cpus()[0]?.model ?? "unknown", logicalCpus: cpus().length, operatingSystem: `${type()} ${release()}`, platform: process.platform, architecture: process.arch }, dataset: { records: records.length, fields: fields.length, configuredViews: Object.keys(configs).length }, warmupRuns: WARMUP_RUNS, measuredRuns: MEASURED_RUNS, aggregation: "P95 nearest-rank after warmup", budgetMs: 300, rawSamplesMs: samples, p95Ms }));
if (failed.length) throw new Error(`Phase 44 release benchmark P95 exceeded: ${failed.map(([name, duration]) => `${name}=${duration}ms`).join(", ")}`);

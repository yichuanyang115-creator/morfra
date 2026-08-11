import { performance } from "node:perf_hooks";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { FieldSummary, RecordData, TableDataSnapshot } from "../src/types/domain";
import { EMPTY_VIEW_PIPELINE, matchesCondition, parseViewPipelineConfig, runViewPipeline, type ViewPipelineConfig } from "../src/lib/table/viewPipeline";
import { GridCell } from "../src/components/table/GridCell";

const visibleFields: FieldSummary[] = [
  { id: "title", tableId: "benchmark", groupId: null, name: "标题", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "status", tableId: "benchmark", groupId: null, name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [{ id: "todo", fieldId: "status", name: "待办", color: "blue", position: 0 }, { id: "done", fieldId: "status", name: "完成", color: "green", position: 1 }] },
  { id: "score", tableId: "benchmark", groupId: null, name: "分数", fieldType: "number", isTitle: false, position: 2, config: {}, options: [] },
  { id: "created", tableId: "benchmark", groupId: null, name: "创建时间", fieldType: "created_time", isTitle: false, position: 3, config: {}, options: [] },
];
const extraFields: FieldSummary[] = Array.from({ length: 196 }, (_, index) => ({ id: `extra-${index}`, tableId: "benchmark", groupId: null, name: `隐藏字段 ${index + 1}`, fieldType: "text", isTitle: false, position: index + visibleFields.length, config: {}, options: [] }));
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

const runInteraction = (name: string, config: ViewPipelineConfig) => {
  const parsed = name === "viewSwitch" ? parseViewPipelineConfig(JSON.parse(JSON.stringify(config))) : config;
  const result = runViewPipeline(data, parsed, name === "search" ? "需求 999" : "");
  renderToString(createElement("div", null, result.records.slice(0, 60).flatMap((record, row) => visibleFields.map((field, column) => createElement(GridCell, { key: `${record.id}:${field.id}`, id: `benchmark-${row}-${column}`, field, record, point: { row, column }, selected: false, active: false, editing: false, conditionalColor: matchesCondition(record.values.score ?? null, "greaterThan", 8000) ? "red" : undefined, readOnly: false, onPointerDown() {}, onPointerEnter() {}, onDoubleClick() {}, onContextMenu() {}, onToggleCheckbox() {} })))));
};

Object.entries(configs).forEach(([name, config]) => runInteraction(name, config));
const samples = Object.fromEntries(Object.entries(configs).map(([name, config]) => [name, Array.from({ length: 3 }, () => {
  const startedAt = performance.now();
  runInteraction(name, config);
  return Number((performance.now() - startedAt).toFixed(2));
})]));
const results = Object.fromEntries(Object.entries(samples).map(([name, durations]) => [name, [...durations].sort((a, b) => a - b)[1]]));
const failed = Object.entries(results).filter(([, duration]) => duration >= 300);
console.log(JSON.stringify({ build: "minified-production-react", records: records.length, searchedFields: fields.length, renderedCellsPerInteraction: 240, samplesPerInteraction: 3, aggregation: "median-after-warmup", budgetMs: 300, samplesMs: samples, durationsMs: results }));
if (failed.length) throw new Error(`Phase 39 release benchmark exceeded: ${failed.map(([name, duration]) => `${name}=${duration}ms`).join(", ")}`);

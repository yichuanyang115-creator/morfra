import { describe, expect, it } from "vitest";
import type { FieldSummary, RecordData, TableDataSnapshot } from "../../types/domain";
import { buildGroupProjection, uniqueProjectedRecordCount } from "./groupProjection";
import { EMPTY_VIEW_PIPELINE, matchesCondition, parseViewPipelineConfig, runViewPipeline, searchableText, stableSort } from "./viewPipeline";

const fields: FieldSummary[] = [
  { id: "title", tableId: "table", groupId: null, name: "标题", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "status", tableId: "table", groupId: null, name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [{ id: "todo", fieldId: "status", name: "待办", color: "blue", position: 0 }, { id: "done", fieldId: "status", name: "完成", color: "green", position: 1 }] },
  { id: "tags", tableId: "table", groupId: null, name: "标签", fieldType: "multi_select", isTitle: false, position: 2, config: {}, options: [{ id: "bug", fieldId: "tags", name: "缺陷", color: "red", position: 0 }, { id: "hot", fieldId: "tags", name: "紧急", color: "yellow", position: 1 }] },
  { id: "score", tableId: "table", groupId: null, name: "分数", fieldType: "number", isTitle: false, position: 3, config: {}, options: [] },
];
const record = (id: string, position: number, status: string | null, tags: string[], score: number): RecordData => ({ id, tableId: "table", position, autoNumber: position + 1, createdAt: "2026-08-11", updatedAt: "2026-08-11", values: { title: id, status, score }, multiSelectValues: { tags } });
const data: TableDataSnapshot = { tableId: "table", groups: [], fields, records: [record("alpha", 2, "todo", ["bug", "hot"], 2), record("beta", 0, "done", ["hot"], 8), record("gamma", 1, null, [], 5)] };

describe("view pipeline", () => {
  it("keeps the required filter → search → group → sort pipeline behavior", () => {
    const result = runViewPipeline(data, { ...EMPTY_VIEW_PIPELINE, filters: [{ id: "score", fieldId: "score", operator: "greaterThan", value: "3" }], sorts: [{ id: "title", fieldId: "title", direction: "desc" }], group: { fieldId: "status", direction: "asc", collapsedKeys: [] } }, "a");
    expect(result.records.map((item) => item.id)).toEqual(["beta", "gamma"]);
    expect(result.total).toBe(3);
    expect(result.matched).toBe(2);
  });

  it("keeps empty values last for both sort directions and preserves manual order for ties", () => {
    const asc = runViewPipeline(data, { ...EMPTY_VIEW_PIPELINE, sorts: [{ id: "score", fieldId: "score", direction: "asc" }] }, "");
    expect(asc.records.map((item) => item.id)).toEqual(["alpha", "gamma", "beta"]);
    const stable = runViewPipeline({ ...data, records: [record("first", 0, "todo", [], 1), record("second", 1, "todo", [], 1)] }, { ...EMPTY_VIEW_PIPELINE, sorts: [{ id: "score", fieldId: "score", direction: "asc" }] }, "");
    expect(stable.records.map((item) => item.id)).toEqual(["first", "second"]);
    const withEmpty = { ...data, records: [{ ...record("empty", 3, "todo", [], 0), values: { title: "empty", status: "todo", score: null } }, ...data.records] };
    const desc = runViewPipeline(withEmpty, { ...EMPTY_VIEW_PIPELINE, sorts: [{ id: "score", fieldId: "score", direction: "desc" }] }, "");
    expect(desc.records[desc.records.length - 1]?.id).toBe("empty");
  });

  it("projects multi-select groups without inflating the unique record total", () => {
    const groups = buildGroupProjection(data.records, fields[2], "asc");
    expect(groups.map((group) => [group.label, group.count])).toEqual([["缺陷", 1], ["紧急", 2], ["未分组", 1]]);
    expect(uniqueProjectedRecordCount(groups)).toBe(3);
    const result = runViewPipeline(data, { ...EMPTY_VIEW_PIPELINE, group: { fieldId: "tags", direction: "asc", collapsedKeys: [] } }, "");
    expect(result.records.map((item) => item.id)).toEqual(["alpha", "beta", "alpha", "gamma"]);
    expect(result.recordGroups.map((group) => group.label)).toEqual(["缺陷", "紧急", "紧急", "未分组"]);
  });

  it("retains defined empty option groups and always places ungrouped last", () => {
    const status = { ...fields[1], options: [...fields[1].options, { id: "blocked", fieldId: "status", name: "阻塞", color: "red", position: 2 }] };
    const groups = buildGroupProjection(data.records, status, "desc");
    expect(groups.map((group) => [group.key, group.count])).toEqual([["blocked", 0], ["done", 1], ["todo", 1], ["__empty__", 1]]);
  });

  it("supports typed numeric, date, checkbox and file conditions", () => {
    expect(matchesCondition(50, "between", [20, 80])).toBe(true);
    expect(matchesCondition("2026-08-11T09:00:00", "on", "2026-08-11")).toBe(true);
    expect(matchesCondition(true, "isChecked")).toBe(true);
    expect(matchesCondition("file:///tmp/phase-39.pdf", "fileNameContains", "phase-39")).toBe(true);
    expect(matchesCondition(["one.pdf", "two.pdf"], "fileCountEquals", 2)).toBe(true);
  });

  it("searches formatted user-facing values and sorts attachments by count then first name", () => {
    const readableFields: FieldSummary[] = [{ id: "amount", tableId: "table", groupId: null, name: "百分比", fieldType: "number", isTitle: false, position: 4, config: { format: "percent" }, options: [] }, { id: "due", tableId: "table", groupId: null, name: "日期", fieldType: "date", isTitle: false, position: 5, config: { includeTime: true }, options: [] }, { id: "link", tableId: "table", groupId: null, name: "链接", fieldType: "link", isTitle: false, position: 6, config: {}, options: [] }, { id: "files", tableId: "table", groupId: null, name: "附件", fieldType: "file", isTitle: false, position: 7, config: {}, options: [] }];
    const first = { ...record("first", 0, null, [], 0), values: { amount: 1234, due: "2026-08-11T09:30:00Z", link: "[Morfra 首页](https://morfra.example)", files: ["z.pdf", "a.pdf"] } };
    const second = { ...record("second", 1, null, [], 0), values: { files: ["b.pdf"] } };
    const text = searchableText(first, readableFields);
    expect(text).toContain(`${new Intl.NumberFormat().format(1234)}%`.toLocaleLowerCase());
    expect(text).toContain(new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date("2026-08-11T09:30:00Z")).toLocaleLowerCase());
    expect(text).toContain("morfra 首页");
    expect(text).toContain("https://morfra.example");
    expect(stableSort([first, second], readableFields, [{ id: "files", fieldId: "files", direction: "asc" }]).map((item) => item.id)).toEqual(["second", "first"]);
  });

  it("reads auto number and system timestamps from their real record properties", () => {
    const systemFields: FieldSummary[] = [{ id: "auto", tableId: "table", groupId: null, name: "编号", fieldType: "auto_number", isTitle: false, position: 4, config: {}, options: [] }, { id: "created", tableId: "table", groupId: null, name: "创建时间", fieldType: "created_time", isTitle: false, position: 5, config: {}, options: [] }];
    const systemData = { ...data, fields: [...fields, ...systemFields], records: data.records.map((item, index) => ({ ...item, autoNumber: index + 7, createdAt: index === 0 ? "2026-08-10T09:00:00Z" : "2026-08-11T09:00:00Z" })) };
    expect(runViewPipeline(systemData, { ...EMPTY_VIEW_PIPELINE, filters: [{ id: "auto", fieldId: "auto", operator: "greaterThan", value: 7 }] }, "").records).toHaveLength(2);
    const grouped = runViewPipeline(systemData, { ...EMPTY_VIEW_PIPELINE, group: { fieldId: "created", direction: "asc", collapsedKeys: [] } }, "");
    expect(grouped.groups.map((group) => group.key)).toEqual(["2026-08-10", "2026-08-11", "__empty__"]);
    expect(runViewPipeline(systemData, EMPTY_VIEW_PIPELINE, "2026-08-10").records.map((item) => item.id)).toEqual(["alpha"]);
  });

  it("parses malformed persisted rules safely", () => {
    expect(parseViewPipelineConfig({ filters: [{ id: "x", fieldId: "score", operator: "bad" }], group: { fieldId: "status", collapsedKeys: ["todo", 1] } })).toEqual({ ...EMPTY_VIEW_PIPELINE, group: { fieldId: "status", direction: "asc", collapsedKeys: ["todo"] } });
  });

  it("processes 10,000 records within the Phase 39 local interaction budget", () => {
    const largeData = { ...data, records: Array.from({ length: 10_000 }, (_, index) => record(`record-${index}`, index, index % 2 ? "todo" : "done", index % 3 ? ["hot"] : ["bug", "hot"], index)) };
    const startedAt = performance.now();
    const result = runViewPipeline(largeData, { ...EMPTY_VIEW_PIPELINE, filters: [{ id: "score", fieldId: "score", operator: "greaterThan", value: "100" }], sorts: [{ id: "score", fieldId: "score", direction: "desc" }], group: { fieldId: "status", direction: "asc", collapsedKeys: [] } }, "record");
    expect(result.records).toHaveLength(9_899);
    expect(performance.now() - startedAt).toBeLessThan(300);
  });

  it("reuses a snapshot-scoped search index after warmup without changing all-field search semantics", () => {
    const largeData = { ...data, records: Array.from({ length: 10_000 }, (_, index) => ({ ...record(`record-${index}`, index, "todo", [], index), values: { title: `标题 ${index}`, note: index === 9_999 ? "唯一可搜索内容" : "常规内容" } })) };
    const fieldsWithNote = [...fields, { id: "note", tableId: "table", groupId: null, name: "备注", fieldType: "text" as const, isTitle: false, position: 4, config: {}, options: [] }];
    const indexedData = { ...largeData, fields: fieldsWithNote };
    expect(runViewPipeline(indexedData, EMPTY_VIEW_PIPELINE, "唯一可搜索内容").records.map((item) => item.id)).toEqual(["record-9999"]);
    const startedAt = performance.now();
    const result = runViewPipeline(indexedData, EMPTY_VIEW_PIPELINE, "唯一可搜索内容");
    expect(result.records).toHaveLength(1);
    expect(performance.now() - startedAt).toBeLessThan(300);
  });
});

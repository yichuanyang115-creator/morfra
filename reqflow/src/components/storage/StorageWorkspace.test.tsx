import { describe, expect, it } from "vitest";
import type { FieldSummary } from "../../types/domain";
import { createGridLayoutSaveCoordinator, gridLayoutSaveRollback, parseCachedGridLayout, shouldRollbackGridLayoutSave } from "./StorageWorkspace";

const fields: FieldSummary[] = [
  { id: "title", tableId: "table-1", groupId: null, name: "名称", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "status", tableId: "table-1", groupId: null, name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [] },
];

describe("parseCachedGridLayout", () => {
  it("配置读取失败后从旧缓存恢复时，画布仍保留主标题", () => {
    expect(parseCachedGridLayout('["status"]', fields).fieldIds).toEqual(["title", "status"]);
  });

  it("空或损坏的本地缓存恢复为默认全字段布局", () => {
    expect(parseCachedGridLayout("[]", fields).fieldIds).toEqual(["title", "status"]);
    expect(parseCachedGridLayout("not-json", fields).fieldIds).toEqual(["title", "status"]);
  });

  it("新格式缓存保留完整字段布局配置", () => {
    expect(parseCachedGridLayout('{"fieldIds":["status"],"groupOrder":["group-1"]}', fields, [{ id: "group-1", tableId: "table-1", name: "阶段", position: 0 }])).toMatchObject({ fieldIds: ["title", "status"], groupOrder: ["group-1", "ungrouped"] });
  });

  it("重启后按已保存的 groupOrder 恢复字段顺序", () => {
    const groupedFields: FieldSummary[] = [
      fields[0],
      { ...fields[1], groupId: "group-a" },
      { id: "owner", tableId: "table-1", groupId: "group-b", name: "负责人", fieldType: "text", isTitle: false, position: 2, config: {}, options: [] },
    ];

    expect(parseCachedGridLayout('{"fieldIds":["title","status","owner"],"groupOrder":["group-b","group-a","ungrouped"]}', groupedFields, [
      { id: "group-a", tableId: "table-1", name: "阶段", position: 0 },
      { id: "group-b", tableId: "table-1", name: "负责人", position: 1 },
    ]).fieldIds).toEqual(["title", "owner", "status"]);
  });

  it("连续保存失败时回到最后确认持久化的布局，而非较早的乐观状态", () => {
    const confirmed = parseCachedGridLayout('{"fieldIds":["title","status"]}', fields);
    const unpersistedPrevious = { ...confirmed, fieldIds: ["title"] };

    expect(gridLayoutSaveRollback(confirmed, unpersistedPrevious)).toBe(confirmed);
  });

  it("布局保存按进入顺序串行，前一次失败也不会阻塞后一次", async () => {
    const coordinator = createGridLayoutSaveCoordinator();
    const calls: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const first = async () => { calls.push("first"); await firstGate; throw new Error("save failed"); };
    const second = async () => { calls.push("second"); };
    const firstSave = coordinator.enqueue(first);
    const secondSave = coordinator.enqueue(second);
    await Promise.resolve();
    expect(calls).toEqual(["first"]);
    releaseFirst?.();
    await Promise.allSettled([firstSave, secondSave]);
    expect(calls).toEqual(["first", "second"]);
  });

  it("生产保存协调器在先成功后失败时保留最近确认快照，并拒绝旧视图回滚", async () => {
    const coordinator = createGridLayoutSaveCoordinator();
    const persisted = parseCachedGridLayout('{"fieldIds":["title","status"]}', fields);
    const savedA = { ...persisted, fieldIds: ["title"] };
    coordinator.confirm("view-a", persisted);
    await coordinator.enqueue(async () => { coordinator.confirm("view-a", savedA); });
    await coordinator.enqueue(async () => { throw new Error("save B failed"); }).catch(() => undefined);

    expect(gridLayoutSaveRollback(coordinator.getConfirmed("view-a"), persisted)).toBe(savedA);
    expect(shouldRollbackGridLayoutSave(2, 2, "view-b", "view-a")).toBe(false);
    expect(shouldRollbackGridLayoutSave(2, 2, "view-a", "view-a")).toBe(true);
  });

  it("生产保存协调器在连续两次失败后仍保留最后确认布局", async () => {
    const coordinator = createGridLayoutSaveCoordinator();
    const persisted = parseCachedGridLayout('{"fieldIds":["title","status"]}', fields);
    coordinator.confirm("view-a", persisted);

    const failedA = coordinator.enqueue(async () => { throw new Error("save A failed"); });
    const failedB = coordinator.enqueue(async () => { throw new Error("save B failed"); });
    await Promise.allSettled([failedA, failedB]);

    expect(coordinator.getConfirmed("view-a")).toBe(persisted);
  });
});

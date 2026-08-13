import { describe, expect, it } from "vitest";
import type { FieldSummary } from "../../types/domain";
import { createGridLayoutSaveCoordinator, gridLayoutSaveRollback, parseCachedGridLayout, parseLoadingGridLayout, resetGridFieldLayout, shouldRollbackGridLayoutSave, shouldShowGridSkeleton } from "./StorageWorkspace";

const fields: FieldSummary[] = [
  { id: "title", tableId: "table-1", groupId: null, name: "名称", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
  { id: "status", tableId: "table-1", groupId: null, name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [] },
];

describe("parseCachedGridLayout", () => {
  it("重置字段布局时保留筛选、排序、分组和条件填色管线", () => {
    const current = parseCachedGridLayout('{"fieldIds":["title"],"filters":[{"id":"f","fieldId":"status","operator":"equals","value":"todo"}],"group":{"fieldId":"status"}}', fields);
    expect(resetGridFieldLayout(current, ["title", "status"]).pipeline).toEqual(current.pipeline);
  });
  it("数据首次加载时从当前视图缓存恢复骨架列数、隐藏列结果和列宽", () => {
    expect(parseLoadingGridLayout('{"fieldIds":["title","owner"],"columnWidths":{"title":280,"owner":120},"rowHeight":56}', "title")).toEqual({
      fieldIds: ["title", "owner"],
      columnWidths: { title: 280, owner: 120 },
      frozenFieldId: null,
      rowHeight: 56,
    });
  });

  it("同表切换视图等待新布局时继续显示目标视图骨架而非空白", () => {
    expect(shouldShowGridSkeleton(true, false, false, false)).toBe(true);
    expect(shouldShowGridSkeleton(true, false, true, false)).toBe(false);
    expect(shouldShowGridSkeleton(false, true, false, false)).toBe(true);
  });

  it("首帧尚未写入 loading 时显示骨架，只有明确加载失败才显示恢复空态", () => {
    expect(shouldShowGridSkeleton(false, false, false, false)).toBe(true);
    expect(shouldShowGridSkeleton(false, false, false, true)).toBe(false);
  });

  it("配置读取失败后从旧缓存恢复时，画布仍保留主标题", () => {
    expect(parseCachedGridLayout('["status"]', fields).fieldIds).toEqual(["title", "status"]);
  });

  it("空或损坏的本地缓存恢复为默认全字段布局", () => {
    expect(parseCachedGridLayout("[]", fields).fieldIds).toEqual(["title", "status"]);
    expect(parseCachedGridLayout("not-json", fields).fieldIds).toEqual(["title", "status"]);
  });

  it("旧字段组缓存不影响普通字段顺序", () => expect(parseCachedGridLayout('{"fieldIds":["status"],"groupOrder":["group-1"]}', fields).fieldIds).toEqual(["title", "status"]));

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

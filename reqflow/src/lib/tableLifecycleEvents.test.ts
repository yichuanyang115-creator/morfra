import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteTableWithLifecycle, emitBeforeTableDeleted, emitTableDeleted, onBeforeTableDeleted, onTableDeleted } from "./tableLifecycleEvents";

describe("tableLifecycleEvents", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it("删除前等待 AI 级联并向调用方传播错误", async () => {
    const cleanup = vi.fn(async () => undefined);
    cleanups.push(onBeforeTableDeleted(cleanup));

    await emitBeforeTableDeleted("table-a");
    expect(cleanup).toHaveBeenCalledWith("table-a");

    cleanups.push(onBeforeTableDeleted(async () => { throw new Error("AI 会话清理失败"); }));
    await expect(emitBeforeTableDeleted("table-a")).rejects.toThrow("AI 会话清理失败");
  });

  it("物理表成功删除后才通知 UI 与适配器", async () => {
    const listener = vi.fn();
    cleanups.push(onTableDeleted(listener));

    await emitTableDeleted("table-a");

    expect(listener).toHaveBeenCalledWith("table-a");
  });

  it("AI 级联失败时不调用物理表删除，也不广播已删除事件", async () => {
    const physicalDelete = vi.fn(async () => "snapshot-after-delete");
    const deleted = vi.fn();
    cleanups.push(onBeforeTableDeleted(async () => { throw new Error("AI 会话清理失败"); }));
    cleanups.push(onTableDeleted(deleted));

    await expect(deleteTableWithLifecycle("table-a", physicalDelete)).rejects.toThrow("AI 会话清理失败");

    expect(physicalDelete).not.toHaveBeenCalled();
    expect(deleted).not.toHaveBeenCalled();
  });

  it("成功路径先完成 AI 清理，再删物理表，最后通知 UI", async () => {
    const calls: string[] = [];
    cleanups.push(onBeforeTableDeleted(async () => { calls.push("ai-cleanup"); }));
    cleanups.push(onTableDeleted(() => { calls.push("ui-notify"); }));

    await expect(deleteTableWithLifecycle("table-a", async () => { calls.push("physical-delete"); return "snapshot"; })).resolves.toBe("snapshot");

    expect(calls).toEqual(["ai-cleanup", "physical-delete", "ui-notify"]);
  });
});

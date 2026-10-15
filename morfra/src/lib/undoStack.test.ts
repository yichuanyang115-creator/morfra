import { describe, expect, it } from "vitest";
import { undoStack } from "./undoStack";

describe("undoStack", () => {
  it("按后进先出顺序执行撤销，并返回对应摘要", async () => {
    undoStack.clear();
    const calls: string[] = [];
    undoStack.push({ summary: "第一步", undo: async () => { calls.push("first"); } });
    undoStack.push({ summary: "第二步", undo: async () => { calls.push("second"); } });

    await expect(undoStack.undo()).resolves.toBe("第二步");
    await expect(undoStack.undo()).resolves.toBe("第一步");
    await expect(undoStack.undo()).resolves.toBeNull();
    expect(calls).toEqual(["second", "first"]);
  });

  it("最多保存 50 条命令", async () => {
    undoStack.clear();
    const calls: number[] = [];
    for (let index = 0; index < 51; index += 1) {
      undoStack.push({ summary: String(index), undo: async () => { calls.push(index); } });
    }

    for (let index = 50; index >= 1; index -= 1) await undoStack.undo();
    expect(calls).toEqual(Array.from({ length: 50 }, (_, index) => 50 - index));
    await expect(undoStack.undo()).resolves.toBeNull();
  });

  it("快速连续撤销时串行等待前一条命令完成，避免异步写入倒序", async () => {
    undoStack.clear();
    const calls: string[] = [];
    let releaseLatest: (() => void) | undefined;
    const latestFinished = new Promise<void>((resolve) => { releaseLatest = resolve; });
    undoStack.push({ summary: "还原 P2", undo: async () => { calls.push("older"); } });
    undoStack.push({
      summary: "还原 P1",
      undo: async () => {
        calls.push("latest");
        await latestFinished;
      },
    });

    const firstUndo = undoStack.undo();
    const secondUndo = undoStack.undo();
    await Promise.resolve();
    expect(calls).toEqual(["latest"]);
    releaseLatest?.();

    await expect(firstUndo).resolves.toBe("还原 P1");
    await expect(secondUndo).resolves.toBe("还原 P2");
    expect(calls).toEqual(["latest", "older"]);
  });

  it("清栈后拒绝异步操作遗留的旧版本命令", () => {
    undoStack.clear();
    const version = undoStack.version;
    undoStack.clear();

    undoStack.pushIfCurrent(version, { summary: "旧快照", undo: async () => undefined });

    expect(undoStack.size).toBe(0);
  });
});

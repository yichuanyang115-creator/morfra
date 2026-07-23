import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./uiStore";
import { defaultStageSort } from "../lib/requirementSort";

describe("uiStore 看板排序状态", () => {
  beforeEach(() => {
    useUiStore.setState({ boardSort: {} });
  });

  it("未配置过的阶段返回默认排序（创建时间降序）", () => {
    expect(useUiStore.getState().getStageSort("design")).toEqual(defaultStageSort());
  });

  it("setStageSortField 设置主排序字段并强制切回规则模式", () => {
    useUiStore.getState().setStageSortManual("design");
    useUiStore.getState().setStageSortField("design", "primary", "priority");

    const sort = useUiStore.getState().getStageSort("design");
    expect(sort.primary).toBe("priority");
    expect(sort.mode).toBe("rule");
  });

  it("setStageSortSecondaryField 设置次排序字段", () => {
    useUiStore.getState().setStageSortSecondaryField("design", "deadline");

    expect(useUiStore.getState().getStageSort("design").secondary).toBe("deadline");
  });

  it("setStageSortSecondaryField 传 null 清空次排序字段", () => {
    useUiStore.getState().setStageSortSecondaryField("design", "deadline");
    useUiStore.getState().setStageSortSecondaryField("design", null);

    expect(useUiStore.getState().getStageSort("design").secondary).toBeNull();
  });

  it("toggleStageSortDir 在 desc/asc 之间切换主排序方向", () => {
    useUiStore.getState().toggleStageSortDir("design", "primary");
    expect(useUiStore.getState().getStageSort("design").primaryDir).toBe("asc");

    useUiStore.getState().toggleStageSortDir("design", "primary");
    expect(useUiStore.getState().getStageSort("design").primaryDir).toBe("desc");
  });

  it("setStageSortManual 把该阶段切到手动模式", () => {
    useUiStore.getState().setStageSortManual("dev");
    expect(useUiStore.getState().getStageSort("dev").mode).toBe("manual");
  });

  it("restoreStageSort 把手动模式切回规则模式，字段配置保持不变", () => {
    useUiStore.getState().setStageSortField("dev", "primary", "priority");
    useUiStore.getState().setStageSortManual("dev");
    expect(useUiStore.getState().getStageSort("dev").mode).toBe("manual");

    useUiStore.getState().restoreStageSort("dev");

    const sort = useUiStore.getState().getStageSort("dev");
    expect(sort.mode).toBe("rule");
    expect(sort.primary).toBe("priority");
  });

  it("不同阶段的排序配置互不影响", () => {
    useUiStore.getState().setStageSortField("design", "primary", "priority");

    expect(useUiStore.getState().getStageSort("design").primary).toBe("priority");
    expect(useUiStore.getState().getStageSort("dev").primary).toBe("createdAt");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./uiStore";
import { defaultStageSort } from "../lib/requirementSort";

describe("uiStore 详情面板三态（AC-002/004/005/006）", () => {
  beforeEach(() => {
    useUiStore.setState({ selectedRequirementId: null, detailMode: "expanded", activeTab: "body" });
  });

  it("selectRequirement 选中需求并把激活 Tab 重置为正文（AC-002：点击行切换为该需求详情）", () => {
    useUiStore.getState().setActiveTab("tasks");
    useUiStore.getState().selectRequirement("req-1");

    const state = useUiStore.getState();
    expect(state.selectedRequirementId).toBe("req-1");
    expect(state.activeTab).toBe("body");
  });

  it("selectRequirement 在收起状态下选中需求会自动展开详情面板", () => {
    useUiStore.getState().toggleCollapsed();
    expect(useUiStore.getState().detailMode).toBe("collapsed");

    useUiStore.getState().selectRequirement("req-2");

    expect(useUiStore.getState().detailMode).toBe("expanded");
  });

  it("selectRequirement 在全屏状态下选中另一条需求不改变全屏态", () => {
    useUiStore.getState().toggleFullscreen();
    expect(useUiStore.getState().detailMode).toBe("fullscreen");

    useUiStore.getState().selectRequirement("req-3");

    expect(useUiStore.getState().detailMode).toBe("fullscreen");
  });

  it("toggleFullscreen 在 expanded 和 fullscreen 之间切换（AC-005：全屏详情占满主内容区）", () => {
    expect(useUiStore.getState().detailMode).toBe("expanded");

    useUiStore.getState().toggleFullscreen();
    expect(useUiStore.getState().detailMode).toBe("fullscreen");

    useUiStore.getState().toggleFullscreen();
    expect(useUiStore.getState().detailMode).toBe("expanded");
  });

  it("toggleCollapsed 在 expanded 和 collapsed 之间切换（AC-006：收起后主内容区恢复全宽）", () => {
    expect(useUiStore.getState().detailMode).toBe("expanded");

    useUiStore.getState().toggleCollapsed();
    expect(useUiStore.getState().detailMode).toBe("collapsed");

    useUiStore.getState().toggleCollapsed();
    expect(useUiStore.getState().detailMode).toBe("expanded");
  });

  it("toggleCollapsed 在全屏态下调用会切到收起（而非回到 expanded），因为它只认 collapsed↔expanded 这一组", () => {
    useUiStore.getState().toggleFullscreen();
    expect(useUiStore.getState().detailMode).toBe("fullscreen");

    useUiStore.getState().toggleCollapsed();

    expect(useUiStore.getState().detailMode).toBe("collapsed");
  });
});

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

import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./uiStore";
import { BOARD_DEFAULT_WIDTH, BOARD_MIN_WIDTH } from "../lib/boardWidth";

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

  it("selectRequirement 在关闭状态下选中需求会自动展开详情面板", () => {
    useUiStore.getState().toggleClosed();
    expect(useUiStore.getState().detailMode).toBe("closed");

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

  it("toggleClosed 在 expanded 和 closed 之间切换（AC-006：关闭后主内容区恢复全宽）", () => {
    expect(useUiStore.getState().detailMode).toBe("expanded");

    useUiStore.getState().toggleClosed();
    expect(useUiStore.getState().detailMode).toBe("closed");

    useUiStore.getState().toggleClosed();
    expect(useUiStore.getState().detailMode).toBe("expanded");
  });

  it("toggleClosed 在全屏态下调用会切到关闭（而非回到 expanded），因为它只认 closed↔expanded 这一组", () => {
    useUiStore.getState().toggleFullscreen();
    expect(useUiStore.getState().detailMode).toBe("fullscreen");

    useUiStore.getState().toggleClosed();

    expect(useUiStore.getState().detailMode).toBe("closed");
  });
});

describe("uiStore 看板宽度（REQ-003 分隔条拖拽）", () => {
  beforeEach(() => {
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH });
  });

  it("默认宽度是 BOARD_DEFAULT_WIDTH", () => {
    expect(useUiStore.getState().boardWidth).toBe(BOARD_DEFAULT_WIDTH);
  });

  it("setBoardWidth 在允许范围内按传入值更新宽度", () => {
    useUiStore.getState().setBoardWidth(700, 1600);
    expect(useUiStore.getState().boardWidth).toBe(700);
  });

  it("setBoardWidth 传入值超出内容能用到的最大宽度时夹到 BOARD_DEFAULT_WIDTH", () => {
    useUiStore.getState().setBoardWidth(900, 1600);
    expect(useUiStore.getState().boardWidth).toBe(BOARD_DEFAULT_WIDTH);
  });

  it("setBoardWidth 传入值超出下限时夹到 BOARD_MIN_WIDTH", () => {
    useUiStore.getState().setBoardWidth(100, 1600);
    expect(useUiStore.getState().boardWidth).toBe(BOARD_MIN_WIDTH);
  });
});

describe("uiStore Schema 设置页导航状态（Phase 18）", () => {
  beforeEach(() => {
    useUiStore.setState({ settingsSection: null });
  });

  it("openSettings 不传参数时默认打开阶段区域", () => {
    useUiStore.getState().openSettings();
    expect(useUiStore.getState().settingsSection).toEqual({ kind: "stages" });
  });

  it("openSettings 传入目标区域时直接定位（右键表头跳转场景）", () => {
    useUiStore.getState().openSettings({ kind: "attributes", attributeId: "priority" });
    expect(useUiStore.getState().settingsSection).toEqual({ kind: "attributes", attributeId: "priority" });
  });

  it("setSettingsSection 切换左侧导航区域", () => {
    useUiStore.getState().openSettings();
    useUiStore.getState().setSettingsSection({ kind: "tab", tabId: "tasks" });

    expect(useUiStore.getState().settingsSection).toEqual({ kind: "tab", tabId: "tasks" });
  });

  it("closeSettings 关闭设置页", () => {
    useUiStore.getState().openSettings();
    useUiStore.getState().closeSettings();

    expect(useUiStore.getState().settingsSection).toBeNull();
  });
});

describe("uiStore 应用设置页导航状态（Phase 28）", () => {
  beforeEach(() => {
    useUiStore.setState({ settingsSection: null, appSettingsSection: null });
  });

  it("打开应用设置默认进入外观，并关闭 Schema 设置状态", () => {
    useUiStore.getState().openSettings();
    useUiStore.getState().openAppSettings();

    expect(useUiStore.getState().appSettingsSection).toBe("appearance");
    expect(useUiStore.getState().settingsSection).toBeNull();
  });

  it("应用设置可切换版本并独立关闭", () => {
    useUiStore.getState().openAppSettings("version");
    useUiStore.getState().setAppSettingsSection("appearance");
    expect(useUiStore.getState().appSettingsSection).toBe("appearance");

    useUiStore.getState().closeAppSettings();
    expect(useUiStore.getState().appSettingsSection).toBeNull();
  });
});

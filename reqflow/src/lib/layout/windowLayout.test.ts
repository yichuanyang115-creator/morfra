import { describe, expect, it } from "vitest";
import { calculateWindowLayout, MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH } from "./windowLayout";

const baseInput = {
  viewportWidth: 1600,
  viewportHeight: 900,
  sidebarOpen: true,
  sidebarWidth: 240,
  detailOpen: false,
  detailWidth: 440,
  aiOpen: false,
  aiWidth: 360,
};

describe("calculateWindowLayout", () => {
  it("宽屏同时打开详情和 AI 时使用双右栏，并保留主区域底线", () => {
    const layout = calculateWindowLayout({ ...baseInput, detailOpen: true, aiOpen: true });

    expect(layout.mode).toBe("regular");
    expect(layout.rightPanelMode).toBe("dual");
    expect(layout.sidebarWidth).toBe(240);
    expect(layout.rightPanelWidth).toBe(776);
    expect(layout.contentHeight).toBe(860);
    expect(baseInput.viewportWidth - layout.sidebarWidth - layout.rightPanelWidth - 16 - 8).toBeGreaterThanOrEqual(560);
  });

  it("空间不足时合并右侧面板，但不改写用户保存的两个面板宽度", () => {
    const layout = calculateWindowLayout({ ...baseInput, viewportWidth: 1200, detailOpen: true, aiOpen: true });

    expect(layout.rightPanelMode).toBe("merged");
    expect(layout.detailWidth).toBe(440);
    expect(layout.aiWidth).toBe(360);
    expect(layout.rightPanelWidth).toBe(384);
  });

  it("窄窗口自动收起导航并把上下文面板变成抽屉", () => {
    const layout = calculateWindowLayout({ ...baseInput, viewportWidth: 1199, detailOpen: true });

    expect(layout.mode).toBe("narrow");
    expect(layout.sidebarMode).toBe("collapsed");
    expect(layout.sidebarWidth).toBe(48);
    expect(layout.rightPanelMode).toBe("drawer");
    expect(layout.rightPanelWidth).toBe(440);
  });

  it("遵守最小窗口合同，不产生负高度或负抽屉宽度", () => {
    const layout = calculateWindowLayout({ ...baseInput, viewportWidth: MIN_WINDOW_WIDTH, viewportHeight: MIN_WINDOW_HEIGHT, detailOpen: true, aiOpen: true });

    expect(layout.contentHeight).toBe(MIN_WINDOW_HEIGHT - 40);
    expect(layout.rightPanelWidth).toBeGreaterThanOrEqual(320);
    expect(layout.sidebarWidth).toBe(48);
  });

  it("侧栏偏好过宽时临时收缩，仍保留常规主区域 560px 底线", () => {
    const layout = calculateWindowLayout({ ...baseInput, viewportWidth: 1200, sidebarWidth: 360, detailOpen: true });

    expect(layout.sidebarWidth).toBe(264);
    expect(1200 - layout.sidebarWidth - layout.rightPanelWidth).toBeGreaterThanOrEqual(560);
  });
});

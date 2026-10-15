import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MainLayout } from "./MainLayout";
import { useAIProviderStore } from "../../stores/aiProviderStore";
import { useUiStore } from "../../stores/uiStore";
import { BOARD_DEFAULT_WIDTH, RESIZER_WIDTH } from "../../lib/boardWidth";

vi.mock("@tauri-apps/plugin-fs", () => ({ exists: vi.fn(async () => false), readTextFile: vi.fn(async () => ""), writeTextFile: vi.fn(async () => undefined), mkdir: vi.fn(async () => undefined) }));
vi.mock("@tauri-apps/api/path", () => ({ appLocalDataDir: vi.fn(async () => "/app-local-data"), join: vi.fn(async (...parts: string[]) => parts.join("/")) }));

describe("MainLayout Phase 6 AI 布局", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1600);
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH });
    useAIProviderStore.setState({ panelOpen: false, panelWidth: 360, loaded: true });
  });

  it("宽屏保留详情三态与独立 AI 第三栏", () => {
    useAIProviderStore.setState({ panelOpen: true });
    const { container } = render(<MainLayout detailMode="expanded" boardContent={<div>表格</div>} detailContent={() => <div>详情</div>} />);
    expect(screen.getByText("表格")).toBeInTheDocument();
    expect(screen.getByText("详情")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "调整 AI 面板宽度" })).toBeInTheDocument();
    expect(container.firstElementChild?.getAttribute("style")).toContain(`${BOARD_DEFAULT_WIDTH}px ${RESIZER_WIDTH}px 1fr`);
    expect(container.querySelector("[data-theme-module=chat]")).toBeInTheDocument();
  });

  it("关闭 AI 时不占用第三栏，详情仍可用", () => {
    const { container } = render(<MainLayout detailMode="expanded" boardContent={<div>表格</div>} detailContent={() => <div>详情</div>} />);
    expect(screen.queryByRole("separator", { name: "调整 AI 面板宽度" })).not.toBeInTheDocument();
    expect(container.firstElementChild?.getAttribute("style")).toContain("0px");
  });

  it("宽屏拖拽 AI 分隔条只改变 AI 偏好宽度", async () => {
    vi.stubGlobal("innerWidth", 1800);
    useAIProviderStore.setState({ panelOpen: true, panelWidth: 360 });
    render(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div />} />);
    const resizer = screen.getByRole("separator", { name: "调整 AI 面板宽度" });
    fireEvent.pointerDown(resizer, { clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 900, pointerId: 1 });
    await waitFor(() => expect(useAIProviderStore.getState().panelWidth).toBeGreaterThan(360));
  });

  it("窄屏切换为右侧覆盖抽屉，不压缩表格轨道", () => {
    vi.stubGlobal("innerWidth", 1000);
    useAIProviderStore.setState({ panelOpen: true, panelWidth: 360 });
    const { container } = render(<MainLayout detailMode="expanded" boardContent={<div>表格</div>} detailContent={() => <div>详情</div>} />);
    expect(screen.getByTestId("ai-drawer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭 AI 面板" })).toBeInTheDocument();
    expect(container.firstElementChild?.getAttribute("style")).not.toContain("360px");
  });

  it("切换详情内容不卸载 AI 面板", () => {
    useAIProviderStore.setState({ panelOpen: true });
    const { rerender } = render(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div>详情 A</div>} />);
    expect(screen.getByTestId("chat-header")).toBeInTheDocument();
    rerender(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div>详情 B</div>} />);
    expect(screen.getByText("详情 B")).toBeInTheDocument();
    expect(screen.getByTestId("chat-header")).toBeInTheDocument();
  });
});

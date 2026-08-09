import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MorfraShell } from "./MorfraShell";
import { useLayoutStore } from "../../stores/layoutStore";
import { useProjectStore } from "../../stores/projectStore";

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

describe("MorfraShell", () => {
  beforeEach(() => {
    setViewport(1280, 800);
    window.localStorage.clear();
    useProjectStore.setState({
      projects: [{ id: "project-1", name: "测试项目", sources: [] }],
      currentProjectId: "project-1",
      loaded: true,
      initializing: false,
      error: false,
    });
    useLayoutStore.setState({
      hydrated: false,
      sidebarOpen: true,
      sidebarWidth: 240,
      detailOpen: false,
      detailWidth: 440,
      aiOpen: false,
      aiWidth: 360,
      activeRightPanel: "detail",
      appearanceMode: "system",
    });
  });

  it("提供 Morfra 标题栏、固定导航和主显示区", () => {
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    expect(screen.getByTestId("morfra-titlebar")).toBeInTheDocument();
    expect(screen.getByText("morfra")).toBeInTheDocument();
    expect(screen.getAllByText("测试项目")).toHaveLength(2);
    expect(screen.getByTestId("morfra-sidebar")).toBeInTheDocument();
    expect(screen.getByText("主表格")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("separator", { name: "调整导航宽度" }), { key: "ArrowRight" });
    expect(useLayoutStore.getState().sidebarWidth).toBe(256);
  });

  it("标题栏 AI 入口可切换右侧抽屉且不影响主区域", async () => {
    setViewport(1199, 800);
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    const toggle = screen.getByRole("button", { name: "打开 AI 表格助手" });
    fireEvent.click(toggle);

    await waitFor(() => expect(screen.getByRole("button", { name: "关闭 AI 表格助手" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByTestId("morfra-shell")).toHaveAttribute("data-window-mode", "narrow");
    expect(screen.getByTestId("morfra-shell")).toHaveAttribute("data-right-panel-mode", "drawer");
    expect(screen.getByText("主表格")).toBeInTheDocument();
  });

  it("双栏实际网格包含侧栏与右栏分隔条，主区保留 560px 计算底线", () => {
    setViewport(1600, 900);
    useLayoutStore.setState({ hydrated: true, detailOpen: true, aiOpen: true });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    const body = screen.getByTestId("morfra-shell").querySelector<HTMLElement>(".morfra-shell-body");
    expect(body?.style.gridTemplateColumns).toBe("240px 8px minmax(0, 1fr) 8px 440px 8px 336px");
  });

  it("详情已打开时，标题栏 AI 入口会切换到 AI 内容而不是继续显示详情", async () => {
    useLayoutStore.setState({ detailOpen: true });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    fireEvent.click(screen.getByRole("button", { name: "打开 AI 表格助手" }));

    await waitFor(() => expect(screen.getByRole("tab", { name: "AI" })).toHaveAttribute("aria-selected", "true"));
  });

  it("窄窗口导航入口打开临时浮层，选择项目后关闭", async () => {
    setViewport(1199, 800);
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    fireEvent.click(screen.getByRole("button", { name: "展开导航" }));
    expect(screen.getByRole("button", { name: "关闭项目导航" })).toBeInTheDocument();

    const projectButtons = screen.getAllByRole("button", { name: "测试项目" });
    fireEvent.click(projectButtons[projectButtons.length - 1]);
    await waitFor(() => expect(screen.queryByRole("button", { name: "关闭项目导航" })).not.toBeInTheDocument());
  });

  it("外观入口按跟随系统、浅色、深色循环并写入根节点", async () => {
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    fireEvent.click(screen.getByRole("button", { name: "切换外观，当前为跟随系统" }));
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe("light"));
    fireEvent.click(screen.getByRole("button", { name: "切换外观，当前为浅色" }));
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe("dark"));
  });
});

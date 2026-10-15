import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WindowLayout } from "../../lib/layout/windowLayout";
import { RightPanelHost } from "./RightPanelHost";

const baseLayout: WindowLayout = { mode: "regular", sidebarMode: "expanded", sidebarWidth: 240, detailWidth: 440, aiWidth: 360, rightPanelWidth: 360, rightPanelMode: "single", contentHeight: 760 };

function renderHost(detailOpen: boolean, aiOpen: boolean, rightPanelMode: WindowLayout["rightPanelMode"] = "single") {
  return render(<RightPanelHost layout={{ ...baseLayout, mode: rightPanelMode === "drawer" ? "narrow" : "regular", rightPanelMode }} activePanel={aiOpen ? "ai" : "detail"} detailOpen={detailOpen} aiOpen={aiOpen} detailContent={<div>详情内容</div>} aiContent={<div>AI 内容</div>} onCloseDetail={vi.fn()} onCloseAi={vi.fn()} onSelectPanel={vi.fn()} onResizeDetail={vi.fn()} onResizeAi={vi.fn()} />);
}

describe("RightPanelHost single mode", () => {
  it("仅 AI 打开时只渲染 AI，不显示无效详情 tab", () => {
    renderHost(false, true);
    expect(screen.getByLabelText("AI 表格助手")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "详情" })).not.toBeInTheDocument();
    expect(screen.queryByText("详情内容")).not.toBeInTheDocument();
  });

  it("仅详情打开时只渲染详情，不显示无效 AI tab", () => {
    renderHost(true, false);
    expect(screen.getByLabelText("记录详情")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "AI" })).not.toBeInTheDocument();
    expect(screen.queryByText("AI 内容")).not.toBeInTheDocument();
  });
});

describe("RightPanelHost drawer mode", () => {
  it("仅 AI 打开时抽屉只渲染 AI，不显示无效详情 tab", () => {
    renderHost(false, true, "drawer");
    expect(screen.getByLabelText("AI 表格助手")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "详情" })).not.toBeInTheDocument();
    expect(screen.queryByText("详情内容")).not.toBeInTheDocument();
  });

  it("仅详情打开时抽屉只渲染详情，不显示无效 AI tab", () => {
    renderHost(true, false, "drawer");
    expect(screen.getByLabelText("记录详情")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "AI" })).not.toBeInTheDocument();
    expect(screen.queryByText("AI 内容")).not.toBeInTheDocument();
  });
});

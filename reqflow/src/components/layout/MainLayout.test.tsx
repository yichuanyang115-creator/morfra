import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MainLayout } from "./MainLayout";

describe("MainLayout（AC-005/006：详情面板三态布局联动）", () => {
  it("expanded：主内容区与详情面板并排展示，分隔条可见", () => {
    render(
      <MainLayout
        detailMode="expanded"
        boardContent={<div>看板内容</div>}
        detailContent={<div>详情内容</div>}
      />,
    );

    expect(screen.getByText("看板内容")).toBeInTheDocument();
    expect(screen.getByText("详情内容")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "调整详情面板宽度" })).toBeInTheDocument();
  });

  it("collapsed：详情面板宽度归零，分隔条不渲染，主内容区仍可见（AC-006：收起后主内容区撑满）", () => {
    render(
      <MainLayout
        detailMode="collapsed"
        boardContent={<div>看板内容</div>}
        detailContent={<div>详情内容</div>}
      />,
    );

    expect(screen.getByText("看板内容")).toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: "调整详情面板宽度" })).not.toBeInTheDocument();
  });

  it("fullscreen：主内容区宽度归零，详情面板占满主内容区位置（AC-005：全屏详情占满主内容区）", () => {
    const { container } = render(
      <MainLayout
        detailMode="fullscreen"
        boardContent={<div>看板内容</div>}
        detailContent={<div>详情内容</div>}
      />,
    );

    expect(screen.getByText("详情内容")).toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: "调整详情面板宽度" })).not.toBeInTheDocument();

    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("0 0 1fr");
  });

  it("三态的 gridTemplateColumns 各不相同，联动关系可回归", () => {
    const { container: expandedContainer } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={<div />} />,
    );
    const { container: collapsedContainer } = render(
      <MainLayout detailMode="collapsed" boardContent={<div />} detailContent={<div />} />,
    );

    const expandedGrid = expandedContainer.firstElementChild as HTMLElement;
    const collapsedGrid = collapsedContainer.firstElementChild as HTMLElement;

    expect(expandedGrid.style.gridTemplateColumns).toBe("var(--board-w) 6px 1fr");
    expect(collapsedGrid.style.gridTemplateColumns).toBe("1fr 0 0");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailHeader } from "./DetailHeader";
import type { Requirement } from "../../types/models";

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: "r-1",
    name: "需求一",
    stage: "design",
    priority: "P2",
    source: "内部想法",
    assignee: "",
    deadline: "",
    progress: null,
    closureType: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    releaseMethod: "",
    releaseDate: "",
    manualOrder: 0,
    body: "",
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

describe("DetailHeader（AC-005/006：全屏展开与收起按钮）", () => {
  it("非全屏时显示进入全屏按钮，点击触发 onToggleFullscreen", async () => {
    const onToggleFullscreen = vi.fn();
    render(
      <DetailHeader
        requirement={makeRequirement()}
        fullscreen={false}
        onRename={vi.fn()}
        onToggleFullscreen={onToggleFullscreen}
      />,
    );

    const button = screen.getByRole("button", { name: "全屏" });
    await userEvent.click(button);

    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("全屏时按钮变为退出全屏，点击同样触发 onToggleFullscreen（同一开关）", async () => {
    const onToggleFullscreen = vi.fn();
    render(
      <DetailHeader
        requirement={makeRequirement()}
        fullscreen={true}
        onRename={vi.fn()}
        onToggleFullscreen={onToggleFullscreen}
      />,
    );

    expect(screen.queryByRole("button", { name: "全屏" })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "退出全屏" });
    await userEvent.click(button);

    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("修改名称后失焦（blur）触发 onRename 带上新名称", async () => {
    const onRename = vi.fn();
    render(
      <DetailHeader
        requirement={makeRequirement({ name: "旧名称" })}
        fullscreen={false}
        onRename={onRename}
        onToggleFullscreen={vi.fn()}
      />,
    );

    const input = screen.getByDisplayValue("旧名称");
    await userEvent.clear(input);
    await userEvent.type(input, "新名称");
    await userEvent.tab();

    expect(onRename).toHaveBeenCalledWith("新名称");
  });

  it("名称未改动时失焦不触发 onRename", async () => {
    const onRename = vi.fn();
    render(
      <DetailHeader
        requirement={makeRequirement({ name: "不变的名称" })}
        fullscreen={false}
        onRename={onRename}
        onToggleFullscreen={vi.fn()}
      />,
    );

    const input = screen.getByDisplayValue("不变的名称");
    await userEvent.click(input);
    await userEvent.tab();

    expect(onRename).not.toHaveBeenCalled();
  });
});

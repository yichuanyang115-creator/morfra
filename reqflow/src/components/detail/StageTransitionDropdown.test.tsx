import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageTransitionDropdown } from "./StageTransitionDropdown";

describe("StageTransitionDropdown", () => {
  it("下拉选项包含除当前阶段外的所有阶段，加一个废弃选项，不包含当前阶段本身", () => {
    render(
      <StageTransitionDropdown currentStage="design" closureType={null} onTransition={vi.fn()} className="" />,
    );

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).not.toContain("设计");
    expect(options).toContain("收集");
    expect(options).toContain("需求");
    expect(options).toContain("开发");
    expect(options).toContain("验证");
    expect(options).toContain("发布");
    expect(options).toContain("归档");
    expect(options).toContain("废弃");
  });

  it("选中目标阶段后，onTransition 收到目标阶段且不带 abandoned 选项", async () => {
    const onTransition = vi.fn();
    render(
      <StageTransitionDropdown currentStage="design" closureType={null} onTransition={onTransition} className="" />,
    );

    await userEvent.selectOptions(screen.getByRole("combobox"), "开发");

    expect(onTransition).toHaveBeenCalledWith("dev");
    expect(onTransition).toHaveBeenCalledTimes(1);
  });

  it("选中废弃后，onTransition 收到 archive 阶段和 abandoned:true，不是原样传递字面量'废弃'", async () => {
    const onTransition = vi.fn();
    render(
      <StageTransitionDropdown currentStage="dev" closureType={null} onTransition={onTransition} className="" />,
    );

    await userEvent.selectOptions(screen.getByRole("combobox"), "废弃");

    expect(onTransition).toHaveBeenCalledWith("archive", { abandoned: true });
  });

  it("选中后下拉值重置为空，不停留在刚选的目标阶段（无确认弹窗，选中即触发且回到占位态）", async () => {
    const onTransition = vi.fn();
    render(
      <StageTransitionDropdown currentStage="design" closureType={null} onTransition={onTransition} className="" />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    await userEvent.selectOptions(select, "开发");

    expect(select.value).toBe("");
  });

  it("当前阶段是废弃归档时，占位选项显示阶段名加（废弃）标记", () => {
    render(
      <StageTransitionDropdown currentStage="archive" closureType="abandoned" onTransition={vi.fn()} className="" />,
    );

    expect(screen.getByText("归档（废弃）")).toBeInTheDocument();
  });

  it("当前阶段是正常完成归档时，占位选项只显示阶段名，不带废弃标记", () => {
    render(
      <StageTransitionDropdown currentStage="archive" closureType="completed" onTransition={vi.fn()} className="" />,
    );

    expect(screen.getByText("归档")).toBeInTheDocument();
    expect(screen.queryByText("归档（废弃）")).not.toBeInTheDocument();
  });
});

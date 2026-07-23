import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortControl } from "./SortControl";
import { defaultStageSort } from "../../lib/requirementSort";

describe("SortControl", () => {
  it("默认不带高亮样式，点击排序按钮展开面板显示主/次排序字段和方向", async () => {
    render(
      <SortControl
        sort={defaultStageSort()}
        onSetPrimaryField={vi.fn()}
        onSetSecondaryField={vi.fn()}
        onToggleDir={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("排序")).not.toHaveClass("bg-(--accent-soft)");
    expect(screen.queryByText("主排序")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("排序"));

    expect(screen.getByText("主排序")).toBeInTheDocument();
    expect(screen.getByText("次排序")).toBeInTheDocument();
  });

  it("非默认排序规则时排序按钮带高亮样式", () => {
    render(
      <SortControl
        sort={{ ...defaultStageSort(), primary: "priority" }}
        onSetPrimaryField={vi.fn()}
        onSetSecondaryField={vi.fn()}
        onToggleDir={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("排序")).toHaveClass("bg-(--accent-soft)");
  });

  it("手动模式不带高亮样式，即使字段配置不是默认值", () => {
    render(
      <SortControl
        sort={{ mode: "manual", primary: "priority", primaryDir: "asc", secondary: null, secondaryDir: "desc" }}
        onSetPrimaryField={vi.fn()}
        onSetSecondaryField={vi.fn()}
        onToggleDir={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("排序")).not.toHaveClass("bg-(--accent-soft)");
  });

  it("手动模式展开面板时显示已手动调整顺序提示和恢复排序按钮，点击触发 onRestore", async () => {
    const onRestore = vi.fn();
    render(
      <SortControl
        sort={{ mode: "manual", primary: "priority", primaryDir: "asc", secondary: null, secondaryDir: "desc" }}
        onSetPrimaryField={vi.fn()}
        onSetSecondaryField={vi.fn()}
        onToggleDir={vi.fn()}
        onRestore={onRestore}
      />,
    );

    await userEvent.click(screen.getByLabelText("排序"));
    expect(screen.getByText("已手动调整顺序")).toBeInTheDocument();

    await userEvent.click(screen.getByText("恢复排序"));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("规则模式展开面板时不显示手动调整提示", async () => {
    render(
      <SortControl
        sort={defaultStageSort()}
        onSetPrimaryField={vi.fn()}
        onSetSecondaryField={vi.fn()}
        onToggleDir={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("排序"));
    expect(screen.queryByText("已手动调整顺序")).not.toBeInTheDocument();
  });

  it("选择主排序字段触发 onSetPrimaryField", async () => {
    const onSetPrimaryField = vi.fn();
    render(
      <SortControl
        sort={defaultStageSort()}
        onSetPrimaryField={onSetPrimaryField}
        onSetSecondaryField={vi.fn()}
        onToggleDir={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("排序"));
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], "priority");

    expect(onSetPrimaryField).toHaveBeenCalledWith("priority");
  });

  it("选择次排序字段为不设置时触发 onSetSecondaryField(null)", async () => {
    const onSetSecondaryField = vi.fn();
    render(
      <SortControl
        sort={{ ...defaultStageSort(), secondary: "priority" }}
        onSetPrimaryField={vi.fn()}
        onSetSecondaryField={onSetSecondaryField}
        onToggleDir={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("排序"));
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[1], "");

    expect(onSetSecondaryField).toHaveBeenCalledWith(null);
  });

  it("点击主排序方向按钮触发 onToggleDir('primary')", async () => {
    const onToggleDir = vi.fn();
    render(
      <SortControl
        sort={defaultStageSort()}
        onSetPrimaryField={vi.fn()}
        onSetSecondaryField={vi.fn()}
        onToggleDir={onToggleDir}
        onRestore={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("排序"));
    await userEvent.click(screen.getAllByLabelText("切换为升序")[0]);

    expect(onToggleDir).toHaveBeenCalledWith("primary");
  });

  it("次排序未设置字段时方向按钮禁用", async () => {
    render(
      <SortControl
        sort={defaultStageSort()}
        onSetPrimaryField={vi.fn()}
        onSetSecondaryField={vi.fn()}
        onToggleDir={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("排序"));
    const dirButtons = screen.getAllByTitle(/降序|升序/);
    expect(dirButtons[1]).toBeDisabled();
  });

  it("点击排序按钮外部区域后面板收起", async () => {
    render(
      <div>
        <SortControl
          sort={defaultStageSort()}
          onSetPrimaryField={vi.fn()}
          onSetSecondaryField={vi.fn()}
          onToggleDir={vi.fn()}
          onRestore={vi.fn()}
        />
        <div data-testid="outside">外部区域</div>
      </div>,
    );

    await userEvent.click(screen.getByLabelText("排序"));
    expect(screen.getByText("主排序")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("outside"));
    expect(screen.queryByText("主排序")).not.toBeInTheDocument();
  });

  it("按 Escape 键后面板收起", async () => {
    render(
      <SortControl
        sort={defaultStageSort()}
        onSetPrimaryField={vi.fn()}
        onSetSecondaryField={vi.fn()}
        onToggleDir={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("排序"));
    expect(screen.getByText("主排序")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("主排序")).not.toBeInTheDocument();
  });

  it("点击排序按钮本身不会触发外部点击收起逻辑（不会先收起再展开导致无法打开）", async () => {
    render(
      <SortControl
        sort={defaultStageSort()}
        onSetPrimaryField={vi.fn()}
        onSetSecondaryField={vi.fn()}
        onToggleDir={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("排序"));
    expect(screen.getByText("主排序")).toBeInTheDocument();
  });
});

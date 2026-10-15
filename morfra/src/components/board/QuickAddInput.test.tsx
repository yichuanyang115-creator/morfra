import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickAddInput } from "./QuickAddInput";

describe("QuickAddInput", () => {
  it("输入非空名称后失焦创建实体", async () => {
    const onSubmit = vi.fn();
    render(<QuickAddInput placeholder="输入名称" attributes={[]} columnWidths={{}} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText("输入名称"), "  新实体  ");
    await userEvent.tab();

    expect(onSubmit).toHaveBeenCalledWith("新实体");
  });

  it("空输入失焦取消草稿，不创建实体", async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<QuickAddInput placeholder="输入名称" attributes={[]} columnWidths={{}} onSubmit={onSubmit} onCancel={onCancel} />);

    await userEvent.tab();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

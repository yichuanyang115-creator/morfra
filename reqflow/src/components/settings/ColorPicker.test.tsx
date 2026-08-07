import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { STAGE_PALETTE } from "../../lib/stagePalette";
import { ColorPicker } from "./ColorPicker";

describe("ColorPicker", () => {
  it("渲染全部 8 个预设色板选项", () => {
    render(<ColorPicker value={STAGE_PALETTE[0]} onChange={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(STAGE_PALETTE.length);
  });

  it("当前值对应的色块标记为已选中", () => {
    render(<ColorPicker value={STAGE_PALETTE[2]} onChange={vi.fn()} />);
    expect(screen.getByLabelText(`颜色 ${STAGE_PALETTE[2]}`)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(`颜色 ${STAGE_PALETTE[0]}`)).toHaveAttribute("aria-pressed", "false");
  });

  it("点击色块触发 onChange 并带上对应颜色值", async () => {
    const onChange = vi.fn();
    render(<ColorPicker value={STAGE_PALETTE[0]} onChange={onChange} />);

    await userEvent.click(screen.getByLabelText(`颜色 ${STAGE_PALETTE[3]}`));
    expect(onChange).toHaveBeenCalledWith(STAGE_PALETTE[3]);
  });

  it("手动输入合法 Hex 后失焦触发 onChange", async () => {
    const onChange = vi.fn();
    render(<ColorPicker value={STAGE_PALETTE[0]} onChange={onChange} />);

    const input = screen.getByLabelText("自定义颜色");
    await userEvent.clear(input);
    await userEvent.type(input, "#4F9200");
    await userEvent.tab();

    expect(onChange).toHaveBeenCalledWith("#4F9200");
  });

  it("手动输入灰色或非法颜色时阻止保存并显示错误", async () => {
    const onChange = vi.fn();
    render(<ColorPicker value={STAGE_PALETTE[0]} onChange={onChange} />);

    const input = screen.getByLabelText("自定义颜色");
    await userEvent.clear(input);
    await userEvent.type(input, "#808080");
    await userEvent.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("不能使用灰色");
  });

  it("手动输入红色时允许保留但提示反馈语义边界", async () => {
    const onChange = vi.fn();
    render(<ColorPicker value={STAGE_PALETTE[0]} onChange={onChange} />);

    const input = screen.getByLabelText("自定义颜色");
    await userEvent.clear(input);
    await userEvent.type(input, "#B3261E");
    await userEvent.tab();

    expect(onChange).toHaveBeenCalledWith("#B3261E");
    expect(screen.getByRole("status")).toHaveTextContent("红色仅建议用于危险反馈");
  });
});

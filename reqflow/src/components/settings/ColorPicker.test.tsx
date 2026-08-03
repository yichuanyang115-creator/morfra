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
});

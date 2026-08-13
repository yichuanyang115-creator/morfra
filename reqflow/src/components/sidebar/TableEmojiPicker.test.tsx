import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableEmojiPicker } from "./TableEmojiPicker";

describe("TableEmojiPicker", () => {
  it("在基础 Emoji 下二级展开肤色变体", () => {
    const onSelect = vi.fn();
    render(<TableEmojiPicker currentEmoji="👋" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("tab", { name: "人物与身体" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "挥手，选择肤色变体" }));

    expect(onSelect).not.toHaveBeenCalled();
    const variants = screen.getByRole("group", { name: "挥手肤色变体" });
    fireEvent.click(variants.querySelectorAll("button")[5]);
    expect(onSelect).toHaveBeenCalledWith("👋🏿");
  });
});

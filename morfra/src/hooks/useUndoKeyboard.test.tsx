import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { undoStack } from "../lib/undoStack";
import { useUndoKeyboard } from "./useUndoKeyboard";

function Harness({ onUndone }: { onUndone: (summary: string) => void }) {
  useUndoKeyboard(onUndone);
  return <><input aria-label="input-draft" /><textarea aria-label="textarea-draft" /><select aria-label="single-select"><option>选项 A</option></select><div aria-label="rich-draft" contentEditable /></>;
}

describe("useUndoKeyboard", () => {
  beforeEach(() => undoStack.clear());

  it("Cmd/Ctrl+Z 撤销最近命令并通知界面显示反馈", async () => {
    const onUndone = vi.fn();
    const undo = vi.fn(async () => undefined);
    undoStack.push({ summary: "删除 Tab 记录", undo });
    render(<Harness onUndone={onUndone} />);

    fireEvent.keyDown(window, { key: "z", metaKey: true });

    await waitFor(() => expect(undo).toHaveBeenCalledOnce());
    expect(onUndone).toHaveBeenCalledWith("删除 Tab 记录");
  });

  it("焦点位于输入框、文本域或富文本编辑器时保留原生撤销", () => {
    const onUndone = vi.fn();
    const undo = vi.fn(async () => undefined);
    undoStack.push({ summary: "修改属性", undo });
    const { getByLabelText } = render(<Harness onUndone={onUndone} />);

    fireEvent.keyDown(getByLabelText("input-draft"), { key: "z", ctrlKey: true });
    fireEvent.keyDown(getByLabelText("textarea-draft"), { key: "z", ctrlKey: true });
    fireEvent.keyDown(getByLabelText("rich-draft"), { key: "z", ctrlKey: true });

    expect(undo).not.toHaveBeenCalled();
    expect(undoStack.size).toBe(1);
  });

  it("焦点位于下拉框时仍执行全局撤销，因为 select 没有原生草稿撤销", async () => {
    const onUndone = vi.fn();
    const undo = vi.fn(async () => undefined);
    undoStack.push({ summary: "修改属性", undo });
    const { getByLabelText } = render(<Harness onUndone={onUndone} />);

    fireEvent.keyDown(getByLabelText("single-select"), { key: "z", metaKey: true });

    await waitFor(() => expect(undo).toHaveBeenCalledOnce());
    expect(onUndone).toHaveBeenCalledWith("修改属性");
  });
});

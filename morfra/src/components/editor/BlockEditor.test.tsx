import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { BlockEditor } from "./BlockEditor";

describe("BlockEditor", () => {
  it("初始 markdown 内容解析为编辑器可渲染的块结构（标题/列表/代码块/引用）", async () => {
    const markdown = [
      "## 背景",
      "",
      "这是正文。",
      "",
      "- 条目一",
      "- 条目二",
      "",
      "```",
      "console.log(1)",
      "```",
      "",
      "> 引用内容",
    ].join("\n");

    const { container } = render(<BlockEditor markdown={markdown} placeholder="占位文案" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(container.querySelector(".block-editor h2")).toHaveTextContent("背景");
    });
    expect(container.querySelectorAll(".block-editor li")).toHaveLength(2);
    expect(container.querySelector(".block-editor pre")).not.toBeNull();
    expect(container.querySelector(".block-editor blockquote")).toHaveTextContent("引用内容");
  });

  it("空 markdown 内容渲染出 Placeholder 占位文案节点", async () => {
    const { container } = render(<BlockEditor markdown="" placeholder="写下需求描述…" onChange={vi.fn()} />);

    await waitFor(() => {
      const emptyNode = container.querySelector(".block-editor .is-editor-empty");
      expect(emptyNode).not.toBeNull();
      expect(emptyNode).toHaveAttribute("data-placeholder", "写下需求描述…");
    });
  });

  it("需求切换时（markdown prop 变为另一份内容）编辑器内容跟着替换", async () => {
    const { container, rerender } = render(
      <BlockEditor markdown="# 需求 A" placeholder="占位" onChange={vi.fn()} />,
    );

    await waitFor(() => {
      expect(container.querySelector(".block-editor h1")).toHaveTextContent("需求 A");
    });

    rerender(<BlockEditor markdown="# 需求 B" placeholder="占位" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(container.querySelector(".block-editor h1")).toHaveTextContent("需求 B");
    });
  });

  it("onEditorReady 拿到的 editor 实例可用来以 markdown 方式插入内容", async () => {
    const editorBox: { current: Editor | null } = { current: null };
    const onChange = vi.fn();

    render(
      <BlockEditor
        markdown=""
        placeholder="占位"
        onChange={onChange}
        onEditorReady={(editor) => {
          editorBox.current = editor;
        }}
      />,
    );

    await waitFor(() => {
      expect(editorBox.current).not.toBeNull();
    });

    const editor = editorBox.current;
    if (!editor) throw new Error("测试前提缺失：editor 未就绪");
    editor.chain().focus().insertContent("## 插入的模板标题", { contentType: "markdown" }).run();

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      const calls = onChange.mock.calls;
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).toContain("插入的模板标题");
    });
  });
});

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";

interface BlockEditorProps {
  markdown: string;
  placeholder: string;
  onChange: (markdown: string) => void;
  onEditorReady?: (editor: Editor) => void;
}

const SAVE_DEBOUNCE_MS = 400;

export function BlockEditor({ markdown, placeholder, onChange, onEditorReady }: BlockEditorProps) {
  const lastSyncedMarkdown = useRef(markdown);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Image, Placeholder.configure({ placeholder }), Markdown],
    content: markdown,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "block-editor",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextMarkdown = currentEditor.getMarkdown();
      lastSyncedMarkdown.current = nextMarkdown;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onChangeRef.current(nextMarkdown);
      }, SAVE_DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    if (!editor) return;
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // 需求切换（换了另一份 markdown 内容）时才重设内容，避免用户打字时因外部
  // markdown prop 引用变化而打断输入光标
  useEffect(() => {
    if (!editor) return;
    if (markdown === lastSyncedMarkdown.current) return;
    lastSyncedMarkdown.current = markdown;
    editor.commands.setContent(markdown, { contentType: "markdown" });
  }, [editor, markdown]);

  return <EditorContent editor={editor} />;
}

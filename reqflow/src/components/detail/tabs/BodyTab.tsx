import type { Editor } from "@tiptap/react";
import { BlockEditor } from "../../editor/BlockEditor";

interface BodyTabProps {
  markdown: string;
  onChange: (markdown: string) => void;
  onEditorReady: (editor: Editor) => void;
}

export function BodyTab({ markdown, onChange, onEditorReady }: BodyTabProps) {
  return (
    <BlockEditor
      markdown={markdown}
      placeholder="写下实体描述，或从 Tab 栏右侧模板插入…"
      onChange={onChange}
      onEditorReady={onEditorReady}
    />
  );
}

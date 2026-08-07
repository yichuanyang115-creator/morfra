import { useState } from "react";
import { ConfirmDialog } from "../shared/ConfirmDialog";

interface SaveTemplateDialogProps {
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}

export function SaveTemplateDialog({ onCancel, onSave }: SaveTemplateDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <ConfirmDialog
      title="保存为模板"
      body="模板只保存当前阶段、属性和 Tab 结构，不会包含任何实体数据或看板视图偏好。"
      onCancel={onCancel}
      onConfirm={() => {
        const trimmed = name.trim();
        if (!trimmed) {
          setError("请填写模板名称");
          return;
        }
        void onSave(trimmed).catch(() => setError("保存失败，请重试"));
      }}
      confirmLabel="保存"
    >
      <input
        autoFocus
        aria-label="模板名称"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="mt-3 w-full rounded-(--r-sm) border border-(--module-scope-border-subtle) px-2 py-1.5 text-[13px] outline-none focus:border-(--module-scope-action-base)"
      />
      {error && <p className="mb-0 text-[12px] text-(--module-scope-feedback-danger)">{error}</p>}
    </ConfirmDialog>
  );
}

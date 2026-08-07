import { useState } from "react";

export function AcceptanceDraftRow({
  onCreate,
  onCancel,
}: {
  onCreate: (desc: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  function resolve() {
    const trimmed = value.trim();
    if (trimmed) onCreate(trimmed);
    else onCancel();
  }

  return (
    <div className="mb-1.5 rounded-(--r-md) border border-(--module-scope-action-base) bg-(--module-scope-action-soft) p-2.25">
      <input
        type="text"
        autoFocus
        placeholder="验收标准描述（必填），填完点其他地方或回车即创建"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={resolve}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          else if (e.key === "Enter") {
            e.preventDefault();
            resolve();
          }
        }}
        className="w-full rounded-(--r-sm) border border-transparent bg-transparent px-1.5 py-1 font-(family-name:--font-body) text-[13px] text-(--module-scope-text-primary) outline-none placeholder:text-(--module-scope-text-tertiary) focus:border-(--module-scope-action-base) focus:bg-(--module-scope-action-soft)"
      />
    </div>
  );
}

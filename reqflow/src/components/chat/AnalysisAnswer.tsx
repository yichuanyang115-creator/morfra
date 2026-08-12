import type { AIAnswerBlock } from "../../types/ai";
import { useState } from "react";
import { MarkdownContent } from "./MarkdownContent";
import type { AIHostActions } from "./chatTypes";

interface AnalysisAnswerProps {
  blocks: AIAnswerBlock[];
  tableId: string;
  hostActions?: AIHostActions;
}

export function AnalysisAnswer({ blocks, tableId, hostActions }: AnalysisAnswerProps) {
  const [referenceErrors, setReferenceErrors] = useState<Record<string, { message: string; retryable: boolean }>>({});
  const [retryingReference, setRetryingReference] = useState<string | null>(null);
  async function openReference(referenceKey: string, recordId: string): Promise<void> {
    if (!hostActions?.openRecord) return;
    setRetryingReference(referenceKey);
    let result;
    try {
      result = await hostActions.openRecord({ tableId, recordId });
    } catch {
      result = { ok: false as const, code: "host-unavailable" as const, message: "记录详情暂时不可用，请重试。", retryable: true };
    }
    setRetryingReference(null);
    if (!result.ok) setReferenceErrors((current) => ({ ...current, [referenceKey]: { message: result.message, retryable: result.retryable } }));
    else setReferenceErrors((current) => { const next = { ...current }; delete next[referenceKey]; return next; });
  }
  return <div className="flex min-w-0 flex-col gap-2 text-[12.5px] text-(--module-scope-text-primary)">
    {blocks.map((block, index) => {
      if (block.type === "markdown") return <MarkdownContent key={`markdown-${index}`} markdown={block.markdown} />;
      if (block.type === "metrics") return <dl key={`metrics-${index}`} className="grid grid-cols-2 gap-1.5">{block.items.map((item) => <div key={item.label} className="rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-canvas) px-2 py-1.5"><dt className="text-[11px] text-(--module-scope-text-secondary)">{item.label}</dt><dd className="m-0 mt-0.5 font-(family-name:--font-mono) text-[14px] font-[590] tabular-nums text-(--module-scope-text-primary)">{String(item.value)}{item.unit ?? ""}</dd></div>)}</dl>;
      if (block.type === "table") return <div key={`table-${index}`} className="overflow-x-auto rounded-(--r-sm) border border-(--module-scope-border-subtle)"><table className="w-full border-collapse text-left text-[11.5px]"><thead><tr>{block.columns.map((column) => <th key={column.id} className="border-b border-(--module-scope-border-subtle) px-2 py-1.5 font-[590]">{column.label}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{block.columns.map((column) => <td key={column.id} className="border-b border-(--module-scope-border-subtle) px-2 py-1.5 last:border-b-0">{String(row[column.id] ?? "")}</td>)}</tr>)}</tbody></table></div>;
      return <div key={`refs-${index}`} className="flex flex-wrap gap-1.5" aria-label="引用记录"><span className="w-full text-[11px] text-(--module-scope-text-secondary)">依据记录</span>{block.records.map((record) => { const referenceKey = `${index}:${record.recordId}`; const error = referenceErrors[referenceKey]; return <div key={record.recordId} className="flex max-w-full flex-wrap items-center gap-1"><button type="button" onClick={() => void openReference(referenceKey, record.recordId)} disabled={!hostActions?.openRecord || retryingReference === referenceKey} className="max-w-full truncate rounded-(--r-full) border border-(--module-scope-border-subtle) bg-transparent px-2 py-1 text-[11.5px] text-(--module-scope-action-strong) hover:bg-(--module-scope-action-soft) disabled:cursor-default disabled:text-(--module-scope-text-secondary)">{record.title}</button>{error && <span role="alert" className="text-[11px] text-(--module-scope-feedback-danger)">{error.message}</span>}{error?.retryable && <button type="button" className="border-none bg-transparent p-0 text-[11px] text-(--module-scope-action-strong) underline" onClick={() => void openReference(referenceKey, record.recordId)}>重试</button>}</div>; })}</div>;
    })}
  </div>;
}

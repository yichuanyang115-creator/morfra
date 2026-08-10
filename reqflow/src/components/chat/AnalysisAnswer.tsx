import type { AIAnswerBlock } from "../../types/ai";
import { MarkdownContent } from "./MarkdownContent";
import type { AIHostActions } from "./chatTypes";

interface AnalysisAnswerProps {
  blocks: AIAnswerBlock[];
  tableId: string;
  hostActions?: AIHostActions;
}

export function AnalysisAnswer({ blocks, tableId, hostActions }: AnalysisAnswerProps) {
  return <div className="flex min-w-0 flex-col gap-2 text-[12.5px] text-(--module-scope-text-primary)">
    {blocks.map((block, index) => {
      if (block.type === "markdown") return <MarkdownContent key={`markdown-${index}`} markdown={block.markdown} />;
      if (block.type === "metrics") return <dl key={`metrics-${index}`} className="grid grid-cols-2 gap-1.5">{block.items.map((item) => <div key={item.label} className="rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-canvas) px-2 py-1.5"><dt className="text-[11px] text-(--module-scope-text-secondary)">{item.label}</dt><dd className="m-0 mt-0.5 font-(family-name:--font-mono) text-[14px] font-[590] tabular-nums text-(--module-scope-text-primary)">{String(item.value)}{item.unit ?? ""}</dd></div>)}</dl>;
      if (block.type === "table") return <div key={`table-${index}`} className="overflow-x-auto rounded-(--r-sm) border border-(--module-scope-border-subtle)"><table className="w-full border-collapse text-left text-[11.5px]"><thead><tr>{block.columns.map((column) => <th key={column.id} className="border-b border-(--module-scope-border-subtle) px-2 py-1.5 font-[590]">{column.label}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{block.columns.map((column) => <td key={column.id} className="border-b border-(--module-scope-border-subtle) px-2 py-1.5 last:border-b-0">{String(row[column.id] ?? "")}</td>)}</tr>)}</tbody></table></div>;
      return <div key={`refs-${index}`} className="flex flex-wrap gap-1.5" aria-label="引用记录"><span className="w-full text-[11px] text-(--module-scope-text-secondary)">依据记录</span>{block.records.map((record) => <button key={record.recordId} type="button" onClick={() => hostActions?.openRecord({ tableId, recordId: record.recordId })} disabled={!hostActions?.openRecord} className="max-w-full truncate rounded-(--r-full) border border-(--module-scope-border-subtle) bg-transparent px-2 py-1 text-[11.5px] text-(--module-scope-action-strong) hover:bg-(--module-scope-action-soft) disabled:cursor-default disabled:text-(--module-scope-text-secondary)">{record.title}</button>)}</div>;
    })}
  </div>;
}

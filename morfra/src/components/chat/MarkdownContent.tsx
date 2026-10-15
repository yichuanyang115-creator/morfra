import type { ReactNode } from "react";

function inlineContent(value: string): ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`)/gu);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-(--module-scope-background-canvas) px-1 font-(family-name:--font-mono) text-[11px]">{part.slice(1, -1)}</code>;
    return <span key={index}>{part}</span>;
  });
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/u.test(line);
}

export function MarkdownContent({ markdown }: { markdown: string }) {
  const safeMarkdown = markdown.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, "").replace(/<[^>]*>/gu, "");
  const lines = safeMarkdown.split(/\r?\n/u);
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) { index += 1; continue; }
    const heading = /^(#{1,3})\s+(.+)$/u.exec(line);
    if (heading) { nodes.push(<h3 key={index} className="m-0 mt-2 text-[13px] font-[590] text-(--module-scope-text-primary)">{inlineContent(heading[2])}</h3>); index += 1; continue; }
    if (index + 1 < lines.length && line.includes("|") && isTableSeparator(lines[index + 1] ?? "")) {
      const headers = line.split("|").map((cell) => cell.trim()).filter(Boolean);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|")) { rows.push((lines[index] ?? "").split("|").map((cell) => cell.trim()).filter(Boolean)); index += 1; }
      nodes.push(<div key={`table-${index}`} className="my-2 overflow-x-auto"><table className="w-full border-collapse text-left text-[11.5px]"><thead><tr>{headers.map((header) => <th key={header} className="border-b border-(--module-scope-border-subtle) px-1.5 py-1 font-[590]">{inlineContent(header)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex} className="border-b border-(--module-scope-border-subtle) px-1.5 py-1">{inlineContent(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    const listMatch = /^\s*([-*]|\d+\.)\s+(.+)$/u.exec(line);
    if (listMatch) {
      const ordered = /^\d+\./u.test(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) { const current = /^\s*([-*]|\d+\.)\s+(.+)$/u.exec(lines[index] ?? ""); if (!current || (ordered !== /^\d+\./u.test(current[1]))) break; items.push(current[2]); index += 1; }
      const List = ordered ? "ol" : "ul";
      nodes.push(<List key={`list-${index}`} className="m-0 my-1 list-inside space-y-0.5 pl-1">{items.map((item, itemIndex) => <li key={itemIndex}>{inlineContent(item)}</li>)}</List>);
      continue;
    }
    const paragraph: string[] = [line]; index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() && !/^(#{1,3})\s+/u.test(lines[index] ?? "") && !/^\s*([-*]|\d+\.)\s+/u.test(lines[index] ?? "")) { paragraph.push(lines[index] ?? ""); index += 1; }
    nodes.push(<p key={`paragraph-${index}`} className="m-0 my-1 leading-5">{inlineContent(paragraph.join(" "))}</p>);
  }
  return <div className="min-w-0 break-words">{nodes.length > 0 ? nodes : <span className="text-(--module-scope-text-tertiary)">正在整理回答…</span>}</div>;
}

import type { FieldType } from "../../types/domain";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "文本", select: "单选", multi_select: "多选", number: "数字", progress: "进度", date: "日期", image: "图片", file: "文件", link: "链接", checkbox: "复选框", auto_number: "自动编号", created_time: "创建时间", updated_time: "最后编辑时间",
};

export function FieldTypeIcon({ type, className }: { type: FieldType; className?: string }) {
  const common = { className, "data-field-type-icon": type, viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (type === "text") return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M8 16 12 8l4 8M9.5 13h5" /></svg>;
  if (type === "select") return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="m8.5 10.5 3.5 3 3.5-3" /></svg>;
  if (type === "multi_select") return <svg {...common}><path d="m4 7 2 2 3-3M4 12l2 2 3-3M4 17l2 2 3-3M13 7h7M13 12h7M13 17h7" /></svg>;
  if (type === "number" || type === "auto_number") return <svg {...common}><path d="M7 4.5v15M15 4.5v15M4.5 9h14M4.5 15h14" /></svg>;
  if (type === "progress") return <svg {...common}><rect x="3.5" y="7" width="17" height="10" rx="2" /><path d="M4 16.5 13.5 7.5M9.5 16.5l9.5-9" /></svg>;
  if (type === "date" || type === "created_time" || type === "updated_time") return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M7 3.5v3M17 3.5v3M3.5 10h17M8 14h.01M12 14h.01M16 14h.01" /></svg>;
  if (type === "checkbox") return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8 12 2.5 2.5L16.5 9" /></svg>;
  if (type === "link") return <svg {...common}><path d="M10 14 14 10M8 16l-1.5 1.5a3 3 0 0 1-4.2-4.2L6 9.5M16 8l1.5-1.5a3 3 0 1 1 4.2 4.2L18 14.5" /></svg>;
  if (type === "image") return <svg {...common}><rect x="3.5" y="4" width="17" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.2" /><path d="m4 18 5.5-5 3.5 3 2.5-2.5 4.5 4.5" /></svg>;
  return <svg {...common}><path d="M7 4.5h8l2 2v13H7z" /><path d="M9.5 11.5h5M9.5 15h3" /></svg>;
}

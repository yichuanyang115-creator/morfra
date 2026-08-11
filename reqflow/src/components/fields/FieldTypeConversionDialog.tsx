import type { ConversionPreview } from "../../lib/fields/valueConversion";
import { FIELD_TYPE_LABELS } from "./FieldEditor";

interface FieldTypeConversionDialogProps {
  preview: ConversionPreview;
  activityTrackingStops?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FieldTypeConversionDialog({ preview, activityTrackingStops = false, onConfirm, onCancel }: FieldTypeConversionDialogProps) {
  return <div className="fixed inset-0 z-70 flex items-center justify-center bg-(--overlay-scrim)" role="dialog" aria-modal="true" aria-labelledby="field-conversion-title"><div className="w-[min(92vw,460px)] rounded-(--r-lg) bg-(--module-scope-background-surface) p-5 shadow-(--shadow-dialog)">
    <h2 id="field-conversion-title" className="m-0 text-[15px] font-semibold text-(--module-scope-text-primary)">转换字段类型</h2>
    <p className="mt-2 text-[12px] text-(--module-scope-text-secondary)">将“{FIELD_TYPE_LABELS[preview.fromType]}”转换为“{FIELD_TYPE_LABELS[preview.toType]}”，会在同一事务中改写记录值。</p>
    <dl className="my-4 grid grid-cols-3 gap-2 text-[11px]"><div className="rounded-(--r-sm) bg-(--module-scope-background-elevated) p-2"><dt className="text-(--module-scope-text-tertiary)">记录</dt><dd className="mt-1 text-[14px] text-(--module-scope-text-primary)">{preview.recordCount}</dd></div><div className="rounded-(--r-sm) bg-(--module-scope-background-elevated) p-2"><dt className="text-(--module-scope-text-tertiary)">可转换</dt><dd className="mt-1 text-[14px] text-(--module-scope-feedback-success)">{preview.convertedCount}</dd></div><div className="rounded-(--r-sm) bg-(--module-scope-background-elevated) p-2"><dt className="text-(--module-scope-text-tertiary)">将清空</dt><dd className="mt-1 text-[14px] text-(--module-scope-feedback-danger)">{preview.clearedCount}</dd></div></dl>
    {preview.generatedOptions.length > 0 && <p className="mb-4 text-[11px] text-(--module-scope-text-secondary)">将生成 {preview.generatedOptions.length} 个选项：{preview.generatedOptions.join("、")}</p>}
    {activityTrackingStops && <p className="mb-4 text-[11px] text-(--module-scope-feedback-danger)">该字段是活动关联字段；转换后活动跟踪将停止，已有历史会保留。</p>}
    <div className="flex justify-end gap-2"><button type="button" className="rounded-(--r-sm) border border-(--module-scope-border-strong) px-3 py-1.5 text-[12px]" onClick={onCancel}>取消</button><button type="button" className="rounded-(--r-sm) bg-(--module-scope-action-base) px-3 py-1.5 text-[12px] text-(--module-scope-background-surface)" onClick={onConfirm}>确认转换</button></div>
  </div></div>;
}

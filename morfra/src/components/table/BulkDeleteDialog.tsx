interface BulkDeleteDialogProps {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BulkDeleteDialog({ count, onConfirm, onCancel }: BulkDeleteDialogProps) {
  return <div className="morfra-grid-dialog-backdrop" role="presentation">
    <section className="morfra-grid-dialog" role="dialog" aria-modal="true" aria-label="确认删除记录">
      <h2>删除 {count} 条记录？</h2>
      <p>记录会立即从当前表中移除，但可以通过撤销恢复。</p>
      <div><button type="button" onClick={onCancel}>取消</button><button type="button" className="is-danger" onClick={onConfirm}>删除记录</button></div>
    </section>
  </div>;
}

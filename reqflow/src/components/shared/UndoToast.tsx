import { Toast } from "./Toast";

interface UndoToastProps {
  summary: string;
  onDismiss: () => void;
}

export function UndoToast({ summary, onDismiss }: UndoToastProps) {
  return <Toast message={`已撤销：${summary}`} onDismiss={onDismiss} />;
}

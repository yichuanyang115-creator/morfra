import type { Task } from "../../../types/models";
import { EmptyState } from "../../shared/EmptyState";
import { TaskCard } from "./TaskCard";
import { TaskDraftRow } from "./TaskDraftRow";
import type { NewTaskInput, TaskPatch } from "./taskShared";

interface TasksTabProps {
  tasks: Task[];
  draftOpen: boolean;
  onCreate: (task: NewTaskInput) => void;
  onCancelDraft: () => void;
  onUpdate: (taskId: string, patch: TaskPatch) => void;
  onRemove: (taskId: string) => void;
}

export function TasksTab({ tasks, draftOpen, onCreate, onCancelDraft, onUpdate, onRemove }: TasksTabProps) {
  if (tasks.length === 0 && !draftOpen) {
    return <EmptyState text="还没有开发任务，点右上角 + 添加" />;
  }

  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div>
      {tasks.length > 0 && (
        <div className="mb-2.5 font-(family-name:--font-mono) text-[11.5px] text-(--muted-2)">
          {doneCount}/{tasks.length} 已完成
        </div>
      )}
      {draftOpen && <TaskDraftRow onCreate={onCreate} onCancel={onCancelDraft} />}
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onUpdate={(patch) => onUpdate(task.id, patch)}
          onRemove={() => onRemove(task.id)}
        />
      ))}
    </div>
  );
}

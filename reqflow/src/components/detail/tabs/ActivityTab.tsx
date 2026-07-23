import { useState } from "react";
import type { Comment, TransitionRecord } from "../../../types/models";
import { EmptyState } from "../../shared/EmptyState";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { TimelineNode } from "./TimelineNode";
import { stageLabelFor } from "./activityShared";

interface ActivityTabProps {
  transitions: TransitionRecord[];
  comments: Comment[];
  closureType: "completed" | "abandoned" | null;
  onUpdateNote: (transitionId: string, note: string) => void;
  onAddComment: (transitionId: string, content: string) => void;
  onDelete: (transitionId: string) => void;
}

export function ActivityTab({ transitions, comments, closureType, onUpdateNote, onAddComment, onDelete }: ActivityTabProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  if (transitions.length === 0) {
    return <EmptyState text="该需求还没有流转记录" />;
  }

  return (
    <>
      <div className="relative pl-5 before:absolute before:top-1.5 before:bottom-1.5 before:left-1 before:w-px before:bg-(--border)">
        {transitions.map((transition, idx) => (
          <TimelineNode
            key={transition.id}
            transition={transition}
            stageLabel={stageLabelFor(transition.to, idx === transitions.length - 1 ? closureType : null)}
            isCurrent={idx === transitions.length - 1}
            comments={comments.filter((c) => c.transitionId === transition.id)}
            onUpdateNote={(note) => onUpdateNote(transition.id, note)}
            onAddComment={(content) => onAddComment(transition.id, content)}
            onDelete={() => setDeleteTargetId(transition.id)}
          />
        ))}
      </div>

      {deleteTargetId && (
        <ConfirmDialog
          title="删除该流转记录？"
          body="该记录及其说明和评论将被永久删除，此操作无法撤销。"
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={() => {
            onDelete(deleteTargetId);
            setDeleteTargetId(null);
          }}
        />
      )}
    </>
  );
}

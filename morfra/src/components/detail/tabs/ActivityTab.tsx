import { useState } from "react";
import type { Comment, Stage, TransitionRecord } from "../../../types/models";
import { EmptyState } from "../../shared/EmptyState";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { TimelineNode } from "./TimelineNode";
import { stageLabelFor } from "./activityShared";

interface ActivityTabProps {
  currentStage: Stage;
  transitions: TransitionRecord[];
  comments: Comment[];
  stageLabels?: Record<string, string>;
  closureType: "completed" | "abandoned" | null;
  onUpdateNote: (transitionId: string, note: string) => void;
  onAddComment: (transitionId: string, content: string) => void;
  onDelete: (transitionId: string) => void;
}

export function ActivityTab({
  currentStage,
  transitions,
  comments,
  stageLabels = {},
  closureType,
  onUpdateNote,
  onAddComment,
  onDelete,
}: ActivityTabProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  if (transitions.length === 0) {
    return <EmptyState text="该实体还没有流转记录" />;
  }

  // 高亮节点是"当前阶段对应的最后一条记录"，不是数组末位——删除最新一条记录后
  // 两者会不一致（stage 不随删除回退），找不到匹配时兜底用数组最后一条。
  let currentIdx = transitions.length - 1;
  for (let i = transitions.length - 1; i >= 0; i--) {
    if (transitions[i].to === currentStage) {
      currentIdx = i;
      break;
    }
  }

  return (
    <>
      <div className="relative pl-5 before:absolute before:top-1.5 before:bottom-1.5 before:left-1 before:w-px before:bg-(--module-scope-border-subtle)">
        {transitions.map((transition, idx) => (
          <TimelineNode
            key={transition.id}
            transition={transition}
            stageLabel={stageLabelFor(transition.to, idx === currentIdx ? closureType : null, transition.toLabel, stageLabels)}
            isCurrent={idx === currentIdx}
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

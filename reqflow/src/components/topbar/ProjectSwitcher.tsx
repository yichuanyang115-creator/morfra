import { useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { CreateProjectForm } from "./CreateProjectForm";

function RenameIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 16l.7-3L13.3 4.4a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1 0 1.4L7.1 15.3 4 16Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M11.7 6l2.3 2.3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface ProjectSwitcherProps {
  onClose: () => void;
}

export function ProjectSwitcher({ onClose }: ProjectSwitcherProps) {
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const switchProject = useProjectStore((s) => s.switchProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
  }

  function commitRename() {
    if (renamingId) {
      const trimmed = renameValue.trim();
      if (trimmed) {
        void renameProject(renamingId, trimmed);
      }
    }
    setRenamingId(null);
  }

  function handleSwitch(id: string) {
    switchProject(id);
    onClose();
  }

  const deleteTarget = projects.find((p) => p.id === deleteTargetId) ?? null;

  return (
    <>
      <div className="fixed left-3 z-50 w-80 rounded-(--r-lg) border border-(--border-strong) bg-(--surface) p-1.5 shadow-[0_12px_32px_-8px_rgba(30,40,70,0.18),0_2px_8px_rgba(30,40,70,0.05)]"
        style={{ top: "calc(var(--topbar-h) + 6px)" }}
      >
        {projects.map((project) => {
          const isActive = project.id === currentProjectId;
          const isRenaming = renamingId === project.id;

          return (
            <div
              key={project.id}
              className={`group flex w-full items-center gap-2.25 rounded-(--r-sm) px-2.25 py-2 text-[13px] text-(--fg) ${
                isActive ? "bg-(--accent-soft) text-(--accent-text)" : "hover:bg-(--surface-2)"
              } ${isRenaming ? "" : "cursor-pointer"}`}
              onClick={isRenaming ? undefined : () => handleSwitch(project.id)}
            >
              {isRenaming ? (
                <input
                  type="text"
                  autoFocus
                  value={renameValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === "Escape") {
                      setRenamingId(null);
                    }
                  }}
                  className="min-w-0 flex-1 rounded border border-(--accent) bg-(--surface) px-1.25 py-0.5 font-(family-name:--font-body) text-[13px] text-(--fg) outline-none"
                />
              ) : (
                <>
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{project.name}</span>
                  <span className="flex flex-none items-center gap-px opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label="重命名项目"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(project.id, project.name);
                      }}
                      className="grid size-5 flex-none place-items-center border-none bg-transparent text-(--muted-2) hover:text-(--fg)"
                    >
                      <RenameIcon />
                    </button>
                    {projects.length > 1 && (
                      <button
                        type="button"
                        aria-label="删除项目"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetId(project.id);
                        }}
                        className="grid size-5 flex-none place-items-center border-none bg-transparent text-(--muted-2) hover:text-(--st-blocked)"
                      >
                        <DeleteIcon />
                      </button>
                    )}
                  </span>
                </>
              )}
            </div>
          );
        })}

        <div className="my-1.25 mx-1 h-px bg-(--border)" />

        <CreateProjectForm onCreated={onClose} />
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title={`删除项目「${deleteTarget.name}」？`}
          body="项目文件夹及全部需求数据将被永久删除，此操作无法撤销。"
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={() => {
            void deleteProject(deleteTarget.id);
            setDeleteTargetId(null);
          }}
        />
      )}
    </>
  );
}

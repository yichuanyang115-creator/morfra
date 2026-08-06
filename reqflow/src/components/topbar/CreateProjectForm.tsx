import { useEffect, useState } from "react";
import type { SchemaTemplate } from "../../types/templates";
import { useProjectStore } from "../../stores/projectStore";
import { useTemplateStore } from "../../stores/templateStore";
import { ConfirmDialog } from "../shared/ConfirmDialog";

interface CreateProjectFormProps {
  onCreated: () => void;
}

function PlusIcon() {
  return (
    <svg className="icon icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CreateProjectForm({ onCreated }: CreateProjectFormProps) {
  const createProject = useProjectStore((state) => state.createProject);
  const templates = useTemplateStore((state) => state.templates);
  const templatesLoaded = useTemplateStore((state) => state.loaded);
  const loading = useTemplateStore((state) => state.loading);
  const templateError = useTemplateStore((state) => state.error);
  const loadTemplates = useTemplateStore((state) => state.load);
  const renameTemplate = useTemplateStore((state) => state.rename);
  const removeTemplate = useTemplateStore((state) => state.remove);
  const [name, setName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [renamingTemplateId, setRenamingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SchemaTemplate | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!templatesLoaded) void loadTemplates();
  }, [loadTemplates, templatesLoaded]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const template = templates.find((item) => item.id === selectedTemplateId);
    try {
      await createProject(trimmed, template);
      onCreated();
    } catch {
      setSubmitError("创建项目失败，请重试");
    }
  }

  async function commitRename() {
    const trimmed = templateName.trim();
    if (renamingTemplateId && trimmed) await renameTemplate(renamingTemplateId, trimmed);
    setRenamingTemplateId(null);
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-2 p-1">
        <div className="flex gap-1.25">
          <input
            type="text"
            placeholder="新建项目名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-1 rounded-(--r-sm) border border-(--border) px-2 py-1.5 font-(family-name:--font-body) text-[12.5px] outline-none focus:border-(--accent)"
          />
          <button type="submit" aria-label="创建" className="grid size-7 flex-none place-items-center rounded-(--r-sm) border-none bg-(--fg) text-(--surface)">
            <PlusIcon />
          </button>
        </div>

        <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
          <legend className="px-0.5 text-[11px] text-(--muted-2)">选择模板</legend>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-(--r-sm) px-1.5 py-1 text-[12px] text-(--fg) hover:bg-(--surface-2)">
            <input type="radio" name="project-template" checked={selectedTemplateId === null} onChange={() => setSelectedTemplateId(null)} />
            不使用模板（空白项目）
          </label>
          {templates.map((template) => (
            <div key={template.id} className="flex items-center gap-1 rounded-(--r-sm) px-1.5 py-1 hover:bg-(--surface-2)">
              {renamingTemplateId === template.id ? (
                <input
                  autoFocus
                  aria-label="模板名称"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  onBlur={() => void commitRename()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commitRename();
                    }
                    if (event.key === "Escape") setRenamingTemplateId(null);
                  }}
                  className="min-w-0 flex-1 rounded border border-(--accent) px-1 py-0.5 text-[12px] outline-none"
                />
              ) : (
                <label className="min-w-0 flex-1 cursor-pointer truncate text-[12px] text-(--fg)">
                  <input
                    type="radio"
                    name="project-template"
                    checked={selectedTemplateId === template.id}
                    onChange={() => setSelectedTemplateId(template.id)}
                    className="mr-1.5"
                  />
                  {template.name}
                </label>
              )}
              <button
                type="button"
                aria-label={`重命名模板 ${template.name}`}
                onClick={() => {
                  setRenamingTemplateId(template.id);
                  setTemplateName(template.name);
                }}
                className="text-[11px] text-(--muted-2) hover:text-(--fg)"
              >
                改名
              </button>
              <button type="button" aria-label={`删除模板 ${template.name}`} onClick={() => setDeleteTarget(template)} className="text-[11px] text-(--muted-2) hover:text-(--st-blocked)">
                删除
              </button>
            </div>
          ))}
          {loading && <p className="m-0 px-1.5 text-[11px] text-(--muted-2)">模板加载中…</p>}
          {templateError && <p className="m-0 px-1.5 text-[11px] text-(--st-blocked)">{templateError}</p>}
        </fieldset>
        {submitError && <p className="m-0 text-[11px] text-(--st-blocked)">{submitError}</p>}
      </form>

      {deleteTarget && (
        <ConfirmDialog
          title={`删除模板「${deleteTarget.name}」？`}
          body="删除后不能恢复，但不会影响已使用它创建的项目。"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            void removeTemplate(deleteTarget.id);
            if (selectedTemplateId === deleteTarget.id) setSelectedTemplateId(null);
            setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}

import type { AcceptanceCriterion, Comment, Deliverable, Requirement, Stage, Task, TransitionRecord } from "../types/models";
import { readFile, writeFile } from "../lib/fs";
import { parseFrontmatter, stringifyFrontmatter } from "../lib/frontmatter";
import { requirementPath } from "../lib/paths";
import { FIELD_KEYS } from "../lib/requirementFields";

export interface RequirementFrontmatter {
  id: string;
  name: string;
  stage: Stage;
  createdAt: string;
  manualOrder: number;
  attributeValues: Record<string, unknown>;
  deliverables: Deliverable[];
  tasks: Task[];
  acceptance: AcceptanceCriterion[];
  transitions: TransitionRecord[];
  comments: Comment[];
}

/** Phase 15 之前落盘的扁平字段格式（无 attributeValues），迁移读取时现场映射。 */
interface LegacyRequirementFrontmatter {
  priority?: string;
  source?: string;
  assignee?: string;
  deadline?: string;
  progress?: number | null;
  closureType?: "completed" | "abandoned" | null;
  releaseMethod?: string;
  releaseDate?: string;
}

type StoredFrontmatter = Partial<RequirementFrontmatter> & LegacyRequirementFrontmatter;

export function toFrontmatter(r: Requirement): RequirementFrontmatter {
  return {
    id: r.id,
    name: r.name,
    stage: r.stage,
    createdAt: r.createdAt,
    manualOrder: r.manualOrder,
    attributeValues: r.attributeValues,
    deliverables: r.deliverables,
    tasks: r.tasks,
    acceptance: r.acceptance,
    transitions: r.transitions,
    comments: r.comments,
  };
}

/** 旧格式（Phase 15 之前）的扁平字段现场映射为 attributeValues，closureType → result（不丢数据）。 */
function attributeValuesFrom(data: StoredFrontmatter): Record<string, unknown> {
  if (data.attributeValues) return data.attributeValues;

  const values: Record<string, unknown> = {};
  if (data.priority !== undefined) values[FIELD_KEYS.priority] = data.priority;
  if (data.source !== undefined) values[FIELD_KEYS.source] = data.source;
  if (data.assignee !== undefined) values[FIELD_KEYS.assignee] = data.assignee;
  if (data.deadline !== undefined) values[FIELD_KEYS.deadline] = data.deadline;
  if (data.progress !== undefined) values[FIELD_KEYS.progress] = data.progress;
  if (data.releaseMethod !== undefined) values[FIELD_KEYS.releaseMethod] = data.releaseMethod;
  if (data.releaseDate !== undefined) values[FIELD_KEYS.releaseDate] = data.releaseDate;
  if (data.closureType !== undefined) values[FIELD_KEYS.result] = data.closureType;
  return values;
}

export function fromFrontmatter(data: StoredFrontmatter, fallbackId: string, body: string): Requirement {
  return {
    id: data.id ?? fallbackId,
    name: data.name ?? "",
    stage: data.stage ?? "collect",
    createdAt: data.createdAt ?? new Date().toISOString(),
    manualOrder: data.manualOrder ?? 0,
    body,
    attributeValues: attributeValuesFrom(data),
    deliverables: data.deliverables ?? [],
    tasks: data.tasks ?? [],
    acceptance: data.acceptance ?? [],
    transitions: data.transitions ?? [],
    comments: data.comments ?? [],
  };
}

export async function loadRequirement(projectId: string, fileName: string): Promise<Requirement | null> {
  const id = fileName.replace(/\.md$/, "");
  const path = await requirementPath(projectId, id);
  const raw = await readFile(path);
  if (raw === null) return null;
  const { data, content } = parseFrontmatter<StoredFrontmatter>(raw);
  return fromFrontmatter(data, id, content);
}

export async function saveRequirement(projectId: string, requirement: Requirement): Promise<void> {
  const path = await requirementPath(projectId, requirement.id);
  await writeFile(path, stringifyFrontmatter(toFrontmatter(requirement), requirement.body));
}

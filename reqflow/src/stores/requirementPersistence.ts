import type {
  AcceptanceCriterion,
  Comment,
  Deliverable,
  Priority,
  Requirement,
  Stage,
  Task,
  TransitionRecord,
} from "../types/models";
import { readFile, writeFile } from "../lib/fs";
import { parseFrontmatter, stringifyFrontmatter } from "../lib/frontmatter";
import { requirementPath } from "../lib/paths";

export interface RequirementFrontmatter {
  id: string;
  name: string;
  stage: Stage;
  priority: Priority;
  source: string;
  assignee: string;
  deadline: string;
  progress: number | null;
  closureType: "completed" | "abandoned" | null;
  createdAt: string;
  releaseMethod: string;
  releaseDate: string;
  manualOrder: number;
  deliverables: Deliverable[];
  tasks: Task[];
  acceptance: AcceptanceCriterion[];
  transitions: TransitionRecord[];
  comments: Comment[];
}

export function toFrontmatter(r: Requirement): RequirementFrontmatter {
  return {
    id: r.id,
    name: r.name,
    stage: r.stage,
    priority: r.priority,
    source: r.source,
    assignee: r.assignee,
    deadline: r.deadline,
    progress: r.progress,
    closureType: r.closureType,
    createdAt: r.createdAt,
    releaseMethod: r.releaseMethod,
    releaseDate: r.releaseDate,
    manualOrder: r.manualOrder,
    deliverables: r.deliverables,
    tasks: r.tasks,
    acceptance: r.acceptance,
    transitions: r.transitions,
    comments: r.comments,
  };
}

export function fromFrontmatter(data: RequirementFrontmatter, fallbackId: string, body: string): Requirement {
  return {
    id: data.id ?? fallbackId,
    name: data.name ?? "",
    stage: data.stage ?? "collect",
    priority: data.priority ?? "P2",
    source: data.source ?? "内部想法",
    assignee: data.assignee ?? "",
    deadline: data.deadline ?? "",
    progress: data.progress ?? null,
    closureType: data.closureType ?? null,
    createdAt: data.createdAt ?? new Date().toISOString(),
    releaseMethod: data.releaseMethod ?? "",
    releaseDate: data.releaseDate ?? "",
    manualOrder: data.manualOrder ?? 0,
    body,
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
  const { data, content } = parseFrontmatter<RequirementFrontmatter>(raw);
  return fromFrontmatter(data, id, content);
}

export async function saveRequirement(projectId: string, requirement: Requirement): Promise<void> {
  const path = await requirementPath(projectId, requirement.id);
  await writeFile(path, stringifyFrontmatter(toFrontmatter(requirement), requirement.body));
}

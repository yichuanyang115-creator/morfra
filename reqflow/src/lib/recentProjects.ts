import type { RecentProject } from "../types/domain";
import { readFile, writeFile } from "./fs";
import { recentProjectsPath } from "./paths";

const MAX_RECENT_PROJECTS = 20;

function isRecentProject(value: unknown): value is RecentProject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string"
    && typeof candidate.path === "string"
    && typeof candidate.name === "string"
    && typeof candidate.lastOpenedAt === "string";
}

export async function loadRecentProjects(): Promise<RecentProject[]> {
  const raw = await readFile(await recentProjectsPath());
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentProject).sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
  } catch {
    return [];
  }
}

async function saveRecentProjects(projects: RecentProject[]): Promise<RecentProject[]> {
  const normalized = projects.slice(0, MAX_RECENT_PROJECTS);
  await writeFile(await recentProjectsPath(), JSON.stringify(normalized, null, 2));
  return normalized;
}

export async function touchRecentProject(project: Omit<RecentProject, "lastOpenedAt">): Promise<RecentProject[]> {
  const current = await loadRecentProjects();
  const next: RecentProject = { ...project, lastOpenedAt: new Date().toISOString() };
  return saveRecentProjects([next, ...current.filter((item) => item.id !== project.id && item.path !== project.path)]);
}

export async function removeRecentProject(id: string): Promise<RecentProject[]> {
  return saveRecentProjects((await loadRecentProjects()).filter((project) => project.id !== id));
}

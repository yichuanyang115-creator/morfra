import { nanoid } from "nanoid";
import { DEFAULT_SOURCES, type Project } from "../types/models";
import type { ProjectSnapshot, RecentProject } from "../types/domain";
import type { SchemaTemplate } from "../types/templates";
import type { Schema } from "../types/schema";
import { ensureDir, readFile, writeFile } from "../lib/fs";
import { parseFrontmatter, stringifyFrontmatter } from "../lib/frontmatter";
import { projectDir, projectMetaPath, schemaPath } from "../lib/paths";
import { blankSchema, legacyEquivalentSchema, schemaFromSnapshot } from "../lib/schemaDefaults";
import { loadRecentProjects, touchRecentProject } from "../lib/recentProjects";
import { createStorageProject, openStorageProject } from "../lib/ipc/storageClient";

interface ProjectFrontmatter {
  id: string;
  name: string;
  sources?: string[];
}

export async function loadLegacyProject(id: string): Promise<Project | null> {
  const raw = await readFile(await projectMetaPath(id));
  if (raw === null) return null;
  const { data } = parseFrontmatter<ProjectFrontmatter>(raw);
  return { id: data.id ?? id, name: data.name ?? id, sources: data.sources ?? DEFAULT_SOURCES };
}

export async function saveLegacyProject(project: Project): Promise<void> {
  await ensureDir(await projectDir(project.id));
  await writeFile(await projectMetaPath(project.id), stringifyFrontmatter({ id: project.id, name: project.name, sources: project.sources }, ""));
}

export async function initLegacySchema(projectId: string, schema: Schema): Promise<void> {
  await writeFile(await schemaPath(projectId), JSON.stringify(schema, null, 2));
}

export async function createDefaultLegacyProject(): Promise<Project> {
  const project: Project = { id: nanoid(), name: "默认项目", sources: DEFAULT_SOURCES };
  await saveLegacyProject(project);
  await initLegacySchema(project.id, legacyEquivalentSchema(project.sources));
  return project;
}

export function storageProject(path: string, snapshot: ProjectSnapshot): Project {
  return { id: snapshot.manifest.id, name: snapshot.manifest.name, sources: [], storagePath: path, storageSnapshot: snapshot };
}

export async function createStorageProjectFromName(name: string, template?: "requirements"): Promise<Project> {
  const path = await projectDir(nanoid());
  const snapshot = await createStorageProject({ path, name, template });
  await touchRecentProject({ id: snapshot.manifest.id, path, name: snapshot.manifest.name });
  return storageProject(path, snapshot);
}

export async function loadStorageProjects(): Promise<Project[]> {
  const recent = await loadRecentProjects();
  const projects: Project[] = [];
  for (const item of recent) {
    try {
      projects.push(storageProject(item.path, await openStorageProject(item.path)));
    } catch {
      // 损坏或被移动的项目不阻断其它最近项目加载，下一次写入时会被清理。
    }
  }
  if (projects.length > 0) {
    const first = projects[0];
    if (first.storagePath) {
      projects[0] = storageProject(first.storagePath, await openStorageProject(first.storagePath));
    }
    return projects;
  }
  return [await createStorageProjectFromName("默认项目")];
}

export async function openStorageProjectAt(path: string): Promise<Project> {
  const snapshot = await openStorageProject(path);
  await touchRecentProject({ id: snapshot.manifest.id, path, name: snapshot.manifest.name });
  return storageProject(path, snapshot);
}

export async function reorderRecentProjects(projects: Project[], recent: RecentProject[]): Promise<Project[]> {
  const order = new Map(recent.map((item, index) => [item.id, index]));
  return projects.slice().sort((left, right) => (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER));
}

export function updateProjectSnapshot(projects: Project[], currentProjectId: string, snapshot: ProjectSnapshot): Project[] {
  return projects.map((project) => project.id === currentProjectId ? { ...project, name: snapshot.manifest.name, storageSnapshot: snapshot } : project);
}

export function legacySchemaForTemplate(template?: SchemaTemplate): Schema {
  return template ? schemaFromSnapshot(template.schemaSnapshot) : blankSchema();
}

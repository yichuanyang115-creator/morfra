import { appLocalDataDir, join } from "@tauri-apps/api/path";

const PROJECTS_DIR = "projects";
const PROJECT_META_FILE = "_project.md";
const CHAT_STATE_FILE = "_chat.md";
const SCHEMA_FILE = "schema.json";

export async function projectsRootDir(): Promise<string> {
  const base = await appLocalDataDir();
  return join(base, PROJECTS_DIR);
}

export async function projectDir(projectId: string): Promise<string> {
  const root = await projectsRootDir();
  return join(root, projectId);
}

export async function projectMetaPath(projectId: string): Promise<string> {
  const dir = await projectDir(projectId);
  return join(dir, PROJECT_META_FILE);
}

export async function chatStatePath(projectId: string): Promise<string> {
  const dir = await projectDir(projectId);
  return join(dir, CHAT_STATE_FILE);
}

export async function schemaPath(projectId: string): Promise<string> {
  const dir = await projectDir(projectId);
  return join(dir, SCHEMA_FILE);
}

export function requirementFileName(requirementId: string): string {
  return `${requirementId}.md`;
}

export async function requirementPath(projectId: string, requirementId: string): Promise<string> {
  const dir = await projectDir(projectId);
  return join(dir, requirementFileName(requirementId));
}

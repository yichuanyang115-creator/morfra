import { appLocalDataDir, join } from "@tauri-apps/api/path";

const PROJECTS_DIR = "projects";
const PROJECT_META_FILE = "_project.md";
const CHAT_STATE_FILE = "_chat.md";
const SCHEMA_FILE = "schema.json";
const TEMPLATES_DIR = "templates";
const TEMPLATES_INITIALIZED_FILE = ".initialized";
const THEME_FILE = "theme.json";
const RECENT_PROJECTS_FILE = "recent-projects.json";

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

export async function templatesRootDir(): Promise<string> {
  return join(await appLocalDataDir(), TEMPLATES_DIR);
}

export async function templatePath(templateId: string): Promise<string> {
  return join(await templatesRootDir(), `${templateId}.json`);
}

export async function templatesInitializedPath(): Promise<string> {
  return join(await templatesRootDir(), TEMPLATES_INITIALIZED_FILE);
}

/** 应用级外观配置：不属于任何项目，不写进 schema 或 Markdown。 */
export async function themePath(): Promise<string> {
  return join(await appLocalDataDir(), THEME_FILE);
}

export async function recentProjectsPath(): Promise<string> {
  return join(await appLocalDataDir(), RECENT_PROJECTS_FILE);
}

export function requirementFileName(requirementId: string): string {
  return `${requirementId}.md`;
}

export async function requirementPath(projectId: string, requirementId: string): Promise<string> {
  const dir = await projectDir(projectId);
  return join(dir, requirementFileName(requirementId));
}

import { appLocalDataDir, join } from "@tauri-apps/api/path";

const PROJECTS_DIR = "projects";
const PROJECT_META_FILE = "_project.md";

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

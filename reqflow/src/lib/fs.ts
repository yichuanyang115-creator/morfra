import { exists, mkdir, readDir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";

export async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true });
  }
}

export async function readFile(path: string): Promise<string | null> {
  if (!(await exists(path))) {
    return null;
  }
  return readTextFile(path);
}

export async function writeFile(path: string, content: string): Promise<void> {
  await writeTextFile(path, content);
}

export async function pathExists(path: string): Promise<boolean> {
  return exists(path);
}

export async function removeDir(path: string): Promise<void> {
  await remove(path, { recursive: true });
}

export async function listDirNames(path: string): Promise<string[]> {
  if (!(await exists(path))) {
    return [];
  }
  const entries = await readDir(path);
  return entries.filter((e) => e.isDirectory).map((e) => e.name);
}

export async function listFileNames(path: string): Promise<string[]> {
  if (!(await exists(path))) {
    return [];
  }
  const entries = await readDir(path);
  return entries.filter((e) => e.isFile).map((e) => e.name);
}

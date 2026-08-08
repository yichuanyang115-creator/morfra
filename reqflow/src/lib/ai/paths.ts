import { appLocalDataDir, join } from "@tauri-apps/api/path";

const AI_DIR = "ai";
const TABLES_DIR = "tables";
const CONVERSATIONS_DIR = "conversations";
const PROVIDERS_FILE = "providers.json";
const PREFERENCES_FILE = "preferences.json";
const CONVERSATION_INDEX_FILE = "conversations.json";

function assertPathSegment(value: string, label: string): void {
  if (!value || value === "." || value === ".." || /[/\\\0]/u.test(value)) {
    throw new Error(`${label} 不是安全的路径标识`);
  }
}

export async function aiRootDir(): Promise<string> {
  return join(await appLocalDataDir(), AI_DIR);
}

export async function aiProvidersPath(): Promise<string> {
  return join(await aiRootDir(), PROVIDERS_FILE);
}

export async function aiPreferencesPath(): Promise<string> {
  return join(await aiRootDir(), PREFERENCES_FILE);
}

export async function aiTablesDir(): Promise<string> {
  return join(await aiRootDir(), TABLES_DIR);
}

export async function aiTableDir(tableId: string): Promise<string> {
  assertPathSegment(tableId, "tableId");
  return join(await aiTablesDir(), tableId);
}

export async function aiConversationIndexPath(tableId: string): Promise<string> {
  return join(await aiTableDir(tableId), CONVERSATION_INDEX_FILE);
}

export async function aiConversationsDir(tableId: string): Promise<string> {
  return join(await aiTableDir(tableId), CONVERSATIONS_DIR);
}

export async function aiConversationPath(tableId: string, conversationId: string): Promise<string> {
  assertPathSegment(conversationId, "conversationId");
  return join(await aiConversationsDir(tableId), `${conversationId}.md`);
}

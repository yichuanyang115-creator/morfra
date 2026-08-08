import { exists, mkdir, readDir, readTextFile, remove, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import { parseFrontmatter, stringifyFrontmatter } from "../frontmatter";
import {
  AI_PERSISTENCE_VERSION,
  type AIConversation,
  type AIConversationDocument,
  type AIConversationIndexDocument,
  type AIConversationIndexEntry,
  type AIPanelPreference,
  type AIProviderConfig,
} from "../../types/ai";
import {
  aiConversationIndexPath,
  aiConversationPath,
  aiConversationsDir,
  aiPreferencesPath,
  aiProvidersPath,
  aiRootDir,
  aiTableDir,
  aiTablesDir,
} from "./paths";
import {
  isConversation,
  normalizePanelPreference,
  normalizeProviderConfig,
  parseConversationDocument,
  parseConversationIndex,
  parsePanelPreferenceDocument,
  parseProviderDocument,
} from "./persistenceValidation";

export interface AIStorageIssue {
  path: string;
  kind: "read-failed" | "corrupt" | "missing-conversation";
  quarantinePath?: string;
}

export interface AIReadResult<T> {
  value: T;
  issues: AIStorageIssue[];
}

const writeQueues = new Map<string, Promise<void>>();
let conversationOperations: Promise<void> = Promise.resolve();
let temporaryFileSequence = 0;

function runConversationOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = conversationOperations.catch(() => undefined).then(operation);
  conversationOperations = result.then(() => undefined, () => undefined);
  return result;
}

async function atomicWrite(path: string, parentDir: string, content: string): Promise<void> {
  const previous = writeQueues.get(path) ?? Promise.resolve();
  const queued = previous.catch(() => undefined).then(async () => {
    await mkdir(parentDir, { recursive: true });
    const temporaryPath = `${path}.tmp-${Date.now()}-${temporaryFileSequence++}`;
    try {
      await writeTextFile(temporaryPath, content);
      await rename(temporaryPath, path);
    } catch (error) {
      if (await exists(temporaryPath)) await remove(temporaryPath).catch(() => undefined);
      throw error;
    }
  });
  const tracked = queued.finally(() => {
    if (writeQueues.get(path) === tracked) writeQueues.delete(path);
  });
  writeQueues.set(path, tracked);
  return tracked;
}

async function quarantine(path: string): Promise<string | undefined> {
  if (!(await exists(path))) return undefined;
  const quarantinePath = `${path}.corrupt-${Date.now()}-${temporaryFileSequence++}`;
  try {
    await rename(path, quarantinePath);
    return quarantinePath;
  } catch {
    return undefined;
  }
}

async function readRaw(path: string): Promise<AIReadResult<string | null>> {
  try {
    if (!(await exists(path))) return { value: null, issues: [] };
    return { value: await readTextFile(path), issues: [] };
  } catch {
    return { value: null, issues: [{ path, kind: "read-failed" }] };
  }
}

async function corruptResult<T>(path: string, fallback: T): Promise<AIReadResult<T>> {
  const quarantinePath = await quarantine(path);
  return { value: fallback, issues: [{ path, kind: "corrupt", quarantinePath }] };
}

function emptyIndex(tableId: string): AIConversationIndexDocument {
  return { version: AI_PERSISTENCE_VERSION, tableId, currentConversationId: null, conversations: [] };
}

function indexEntry(conversation: AIConversation): AIConversationIndexEntry {
  const { id, tableId, mode, title, providerConfigId, modelId, createdAt, updatedAt } = conversation;
  return { id, tableId, mode, title, providerConfigId, modelId, createdAt, updatedAt };
}

function renderConversation(conversation: AIConversation): string {
  const lines = [`# ${conversation.title}`];
  for (const message of conversation.messages) {
    lines.push("", message.role === "user" ? "## 用户" : "## AI");
    for (const block of message.contentBlocks) {
      if (block.type === "markdown") lines.push("", block.markdown);
      if (block.type === "metrics") lines.push("", ...block.items.map((item) => `- ${item.label}: ${String(item.value)}${item.unit ?? ""}`));
      if (block.type === "recordRefs") lines.push("", ...block.records.map((record) => `- ${record.title} (${record.recordId})`));
      if (block.type === "table") lines.push("", `表格结果：${block.rows.length} 行`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export async function loadAIProviderConfigs(): Promise<AIReadResult<AIProviderConfig[]>> {
  const path = await aiProvidersPath();
  const raw = await readRaw(path);
  if (raw.value === null) return { value: [], issues: raw.issues };
  try {
    const document = parseProviderDocument(JSON.parse(raw.value) as unknown);
    return document ? { value: document.configs, issues: [] } : corruptResult(path, []);
  } catch {
    return corruptResult(path, []);
  }
}

export async function saveAIProviderConfigs(configs: AIProviderConfig[]): Promise<void> {
  const path = await aiProvidersPath();
  const document = { version: AI_PERSISTENCE_VERSION, configs: configs.map(normalizeProviderConfig) };
  await atomicWrite(path, await aiRootDir(), `${JSON.stringify(document, null, 2)}\n`);
}

export async function loadAIPanelPreference(fallback: AIPanelPreference): Promise<AIReadResult<AIPanelPreference>> {
  const path = await aiPreferencesPath();
  const raw = await readRaw(path);
  if (raw.value === null) return { value: normalizePanelPreference(fallback), issues: raw.issues };
  try {
    const document = parsePanelPreferenceDocument(JSON.parse(raw.value) as unknown);
    return document ? { value: document.preference, issues: [] } : corruptResult(path, normalizePanelPreference(fallback));
  } catch {
    return corruptResult(path, normalizePanelPreference(fallback));
  }
}

export async function saveAIPanelPreference(preference: AIPanelPreference): Promise<void> {
  const path = await aiPreferencesPath();
  const document = { version: AI_PERSISTENCE_VERSION, preference: normalizePanelPreference(preference) };
  await atomicWrite(path, await aiRootDir(), `${JSON.stringify(document, null, 2)}\n`);
}

async function readAIConversationIndex(tableId: string): Promise<AIReadResult<AIConversationIndexDocument>> {
  const path = await aiConversationIndexPath(tableId);
  const raw = await readRaw(path);
  if (raw.value === null) return { value: emptyIndex(tableId), issues: raw.issues };
  try {
    const document = parseConversationIndex(JSON.parse(raw.value) as unknown, tableId);
    return document ? { value: document, issues: [] } : corruptResult(path, emptyIndex(tableId));
  } catch {
    return corruptResult(path, emptyIndex(tableId));
  }
}

async function readAIConversation(tableId: string, conversationId: string): Promise<AIReadResult<AIConversation | null>> {
  const path = await aiConversationPath(tableId, conversationId);
  const raw = await readRaw(path);
  if (raw.value === null) return { value: null, issues: raw.issues.length ? raw.issues : [{ path, kind: "missing-conversation" }] };
  try {
    const parsed = parseFrontmatter<unknown>(raw.value);
    const document = parseConversationDocument(parsed.data, tableId, conversationId);
    return document ? { value: document.conversation, issues: [] } : corruptResult(path, null);
  } catch {
    return corruptResult(path, null);
  }
}

interface ReconciledConversations {
  index: AIConversationIndexDocument;
  conversations: AIConversation[];
  issues: AIStorageIssue[];
}

async function reconcileConversations(
  tableId: string,
  preferredCurrentId?: string | null,
): Promise<ReconciledConversations> {
  const index = await readAIConversationIndex(tableId);
  const conversations: AIConversation[] = [];
  const issues = [...index.issues];
  const directory = await aiConversationsDir(tableId);
  const entries = await exists(directory) ? await readDir(directory) : [];
  const conversationIds = entries
    .filter((entry) => entry.isFile && entry.name.endsWith(".md"))
    .map((entry) => entry.name.slice(0, -3));
  for (const conversationId of conversationIds) {
    const loaded = await readAIConversation(tableId, conversationId);
    if (loaded.value) conversations.push(loaded.value);
    issues.push(...loaded.issues);
  }
  const actualIds = new Set(conversations.map((conversation) => conversation.id));
  for (const stale of index.value.conversations.filter((entry) => !actualIds.has(entry.id))) {
    const stalePath = await aiConversationPath(tableId, stale.id);
    if (!issues.some((issue) => issue.path === stalePath)) {
      issues.push({ path: stalePath, kind: "missing-conversation" });
    }
  }
  conversations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const candidateCurrentId = preferredCurrentId === undefined
    ? index.value.currentConversationId
    : preferredCurrentId;
  const nextIndex: AIConversationIndexDocument = {
    version: AI_PERSISTENCE_VERSION,
    tableId,
    currentConversationId: candidateCurrentId && actualIds.has(candidateCurrentId)
      ? candidateCurrentId
      : conversations[0]?.id ?? null,
    conversations: conversations.map(indexEntry),
  };
  if (JSON.stringify(nextIndex) !== JSON.stringify(index.value) || index.issues.length > 0) {
    await atomicWrite(
      await aiConversationIndexPath(tableId),
      await aiTableDir(tableId),
      `${JSON.stringify(nextIndex, null, 2)}\n`,
    );
  }
  return { index: nextIndex, conversations, issues };
}

export function loadAIConversationIndex(tableId: string): Promise<AIReadResult<AIConversationIndexDocument>> {
  return runConversationOperation(async () => {
    const reconciled = await reconcileConversations(tableId);
    return { value: reconciled.index, issues: reconciled.issues };
  });
}

export function loadAIConversation(tableId: string, conversationId: string): Promise<AIReadResult<AIConversation | null>> {
  return runConversationOperation(() => readAIConversation(tableId, conversationId));
}

export function loadAIConversations(tableId: string): Promise<AIReadResult<AIConversation[]>> {
  return runConversationOperation(async () => {
    const reconciled = await reconcileConversations(tableId);
    return { value: reconciled.conversations, issues: reconciled.issues };
  });
}

export function saveAIConversation(conversation: AIConversation, makeCurrent = true): Promise<void> {
  if (!isConversation(conversation)) throw new Error("会话数据无效");
  return runConversationOperation(async () => {
    const conversationPath = await aiConversationPath(conversation.tableId, conversation.id);
    const document: AIConversationDocument = { version: AI_PERSISTENCE_VERSION, conversation };
    await atomicWrite(
      conversationPath,
      await aiConversationsDir(conversation.tableId),
      stringifyFrontmatter(document, renderConversation(conversation)),
    );
    await reconcileConversations(conversation.tableId, makeCurrent ? conversation.id : undefined);
  });
}

export function deleteAIConversation(tableId: string, conversationId: string): Promise<void> {
  return runConversationOperation(async () => {
    const path = await aiConversationPath(tableId, conversationId);
    if (await exists(path)) await remove(path);
    await reconcileConversations(tableId);
  });
}

export function deleteTableAIData(tableId: string): Promise<void> {
  return runConversationOperation(async () => {
    const path = await aiTableDir(tableId);
    if (await exists(path)) await remove(path, { recursive: true });
  });
}

export function clearAllAIConversationData(): Promise<void> {
  return runConversationOperation(async () => {
    const path = await aiTablesDir();
    if (await exists(path)) await remove(path, { recursive: true });
  });
}

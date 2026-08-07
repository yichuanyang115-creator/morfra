import { create } from "zustand";
import { nanoid } from "nanoid";
import { readFile, writeFile } from "../lib/fs";
import { parseFrontmatter, stringifyFrontmatter } from "../lib/frontmatter";
import { chatStatePath } from "../lib/paths";
import { CHAT_DEFAULT_WIDTH } from "../lib/boardWidth";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** 假数据阶段固定回复文案，不随输入内容变化（REQ-024 MUST NOT 接入真实 AI）。 */
const FAKE_REPLY = "这个功能还在开发中，暂时只能陪你聊聊。";

const THINKING_DELAY_MS = 600;

const persistQueues = new Map<string, Promise<void>>();

interface ChatFrontmatter {
  open: boolean;
  width: number;
  messages: ChatMessage[];
}

interface ChatState {
  open: boolean;
  width: number;
  messages: ChatMessage[];
  thinking: boolean;
  persistenceError: string | null;
  /** 用于让清空/切换项目使旧的延迟假回复失效，不落盘。 */
  replyToken: number;
  loadedProjectId: string | null;
  loadForProject: (projectId: string) => Promise<void>;
  toggleOpen: () => Promise<void>;
  setWidth: (width: number) => Promise<void>;
  sendMessage: (content: string) => void;
  clearChat: () => Promise<void>;
}

async function persistSafely(
  projectId: string,
  open: boolean,
  width: number,
  messages: ChatMessage[],
): Promise<boolean> {
  try {
    await persist(projectId, open, width, messages);
    return true;
  } catch {
    return false;
  }
}

async function persist(
  projectId: string,
  open: boolean,
  width: number,
  messages: ChatMessage[],
): Promise<void> {
  const previous = persistQueues.get(projectId) ?? Promise.resolve();
  const queued = previous.then(async () => {
    const path = await chatStatePath(projectId);
    const frontmatter: ChatFrontmatter = { open, width, messages };
    await writeFile(path, stringifyFrontmatter(frontmatter, ""));
  });
  const tracked = queued.then(
    () => {
      if (persistQueues.get(projectId) === tracked) persistQueues.delete(projectId);
    },
    (error) => {
      if (persistQueues.get(projectId) === tracked) persistQueues.delete(projectId);
      throw error;
    },
  );
  persistQueues.set(projectId, tracked);
  return tracked;
}

async function waitForPersist(projectId: string): Promise<void> {
  await persistQueues.get(projectId);
}

export const useChatStore = create<ChatState>((set, get) => ({
  open: false,
  width: CHAT_DEFAULT_WIDTH,
  messages: [],
  thinking: false,
  persistenceError: null,
  replyToken: 0,
  loadedProjectId: null,

  loadForProject: async (projectId) => {
    await waitForPersist(projectId);
    const path = await chatStatePath(projectId);
    const raw = await readFile(path);
    if (raw === null) {
      set((state) => ({ open: false, width: CHAT_DEFAULT_WIDTH, messages: [], thinking: false, persistenceError: null, loadedProjectId: projectId, replyToken: state.replyToken + 1 }));
      return;
    }
    const { data } = parseFrontmatter<Partial<ChatFrontmatter>>(raw);
    set((state) => ({
      open: data.open ?? false,
      width: data.width ?? CHAT_DEFAULT_WIDTH,
      messages: data.messages ?? [],
      thinking: false,
      persistenceError: null,
      loadedProjectId: projectId,
      replyToken: state.replyToken + 1,
    }));
  },

  toggleOpen: async () => {
    const { loadedProjectId, open, width, messages } = get();
    if (!loadedProjectId) return;
    const next = !open;
    set({ open: next });
    const saved = await persistSafely(loadedProjectId, next, width, messages);
    if (get().loadedProjectId === loadedProjectId) set({ persistenceError: saved ? null : "对话保存失败，请检查应用数据目录" });
  },

  setWidth: async (width) => {
    const { loadedProjectId, open, messages } = get();
    if (!loadedProjectId) return;
    set({ width });
    const saved = await persistSafely(loadedProjectId, open, width, messages);
    if (get().loadedProjectId === loadedProjectId) set({ persistenceError: saved ? null : "对话保存失败，请检查应用数据目录" });
  },

  sendMessage: (content) => {
    const trimmed = content.trim();
    const { loadedProjectId, replyToken } = get();
    if (!trimmed || !loadedProjectId) return;

    const userMessage: ChatMessage = { id: nanoid(), role: "user", content: trimmed };
    const afterUser = [...get().messages, userMessage];
    set({ messages: afterUser, thinking: true });
    void persistSafely(loadedProjectId, get().open, get().width, afterUser).then((saved) => {
      if (get().loadedProjectId === loadedProjectId) set({ persistenceError: saved ? null : "对话保存失败，请检查应用数据目录" });
    });

    setTimeout(() => {
      // 思考延迟期间用户可能已经切换了项目，这时不该把回复写回当前（新）项目的状态里。
      if (get().loadedProjectId !== loadedProjectId || get().replyToken !== replyToken) return;
      const assistantMessage: ChatMessage = { id: nanoid(), role: "assistant", content: FAKE_REPLY };
      const afterReply = [...get().messages, assistantMessage];
      set({ messages: afterReply, thinking: false });
      void persistSafely(loadedProjectId, get().open, get().width, afterReply).then((saved) => {
        if (get().loadedProjectId === loadedProjectId) set({ persistenceError: saved ? null : "对话保存失败，请检查应用数据目录" });
      });
    }, THINKING_DELAY_MS);
  },

  clearChat: async () => {
    const { loadedProjectId, open, width } = get();
    if (!loadedProjectId) return;
    set((state) => ({ messages: [], thinking: false, replyToken: state.replyToken + 1 }));
    const saved = await persistSafely(loadedProjectId, open, width, []);
    if (get().loadedProjectId === loadedProjectId) set({ persistenceError: saved ? null : "对话保存失败，请检查应用数据目录" });
  },
}));

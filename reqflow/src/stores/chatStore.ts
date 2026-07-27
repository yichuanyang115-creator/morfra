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
  loadedProjectId: string | null;
  loadForProject: (projectId: string) => Promise<void>;
  toggleOpen: () => Promise<void>;
  setWidth: (width: number) => Promise<void>;
  sendMessage: (content: string) => void;
  clearChat: () => Promise<void>;
}

async function persist(
  projectId: string,
  open: boolean,
  width: number,
  messages: ChatMessage[],
): Promise<void> {
  const path = await chatStatePath(projectId);
  const frontmatter: ChatFrontmatter = { open, width, messages };
  await writeFile(path, stringifyFrontmatter(frontmatter, ""));
}

export const useChatStore = create<ChatState>((set, get) => ({
  open: false,
  width: CHAT_DEFAULT_WIDTH,
  messages: [],
  thinking: false,
  loadedProjectId: null,

  loadForProject: async (projectId) => {
    const path = await chatStatePath(projectId);
    const raw = await readFile(path);
    if (raw === null) {
      set({ open: false, width: CHAT_DEFAULT_WIDTH, messages: [], thinking: false, loadedProjectId: projectId });
      return;
    }
    const { data } = parseFrontmatter<Partial<ChatFrontmatter>>(raw);
    set({
      open: data.open ?? false,
      width: data.width ?? CHAT_DEFAULT_WIDTH,
      messages: data.messages ?? [],
      thinking: false,
      loadedProjectId: projectId,
    });
  },

  toggleOpen: async () => {
    const { loadedProjectId, open, width, messages } = get();
    if (!loadedProjectId) return;
    const next = !open;
    set({ open: next });
    await persist(loadedProjectId, next, width, messages);
  },

  setWidth: async (width) => {
    const { loadedProjectId, open, messages } = get();
    if (!loadedProjectId) return;
    set({ width });
    await persist(loadedProjectId, open, width, messages);
  },

  sendMessage: (content) => {
    const trimmed = content.trim();
    const { loadedProjectId } = get();
    if (!trimmed || !loadedProjectId) return;

    const userMessage: ChatMessage = { id: nanoid(), role: "user", content: trimmed };
    const afterUser = [...get().messages, userMessage];
    set({ messages: afterUser, thinking: true });
    void persist(loadedProjectId, get().open, get().width, afterUser);

    setTimeout(() => {
      // 思考延迟期间用户可能已经切换了项目，这时不该把回复写回当前（新）项目的状态里。
      if (get().loadedProjectId !== loadedProjectId) return;
      const assistantMessage: ChatMessage = { id: nanoid(), role: "assistant", content: FAKE_REPLY };
      const afterReply = [...get().messages, assistantMessage];
      set({ messages: afterReply, thinking: false });
      void persist(loadedProjectId, get().open, get().width, afterReply);
    }, THINKING_DELAY_MS);
  },

  clearChat: async () => {
    const { loadedProjectId, open, width } = get();
    if (!loadedProjectId) return;
    set({ messages: [], thinking: false });
    await persist(loadedProjectId, open, width, []);
  },
}));

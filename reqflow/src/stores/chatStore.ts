import { create } from "zustand";
import { nanoid } from "nanoid";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** 假数据阶段固定回复文案，不随输入内容变化（REQ-024 MUST NOT 接入真实 AI）。 */
const FAKE_REPLY = "这个功能还在开发中，暂时只能陪你聊聊。";

const THINKING_DELAY_MS = 600;

interface ChatState {
  messages: ChatMessage[];
  thinking: boolean;
  sendMessage: (content: string) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  thinking: false,

  sendMessage: (content) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = { id: nanoid(), role: "user", content: trimmed };
    set({ messages: [...get().messages, userMessage], thinking: true });

    setTimeout(() => {
      const assistantMessage: ChatMessage = { id: nanoid(), role: "assistant", content: FAKE_REPLY };
      set({ messages: [...get().messages, assistantMessage], thinking: false });
    }, THINKING_DELAY_MS);
  },

  clearChat: () => {
    set({ messages: [], thinking: false });
  },
}));

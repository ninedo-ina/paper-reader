"use client"

import { create } from "zustand"
import type { AiChatListDto, AiChatDetailDto, AiMessageDto } from "@/lib/api/types"
import { listChats, getChat, createChat, sendMessage, deleteChat } from "@/lib/api/ai-chats"

const MODELS = ["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-6", "gemini-2.5-pro"] as const

interface ChatState {
  chats: AiChatListDto[]
  activeChat: AiChatDetailDto | null
  messages: AiMessageDto[]
  isLoading: boolean
  isSending: boolean
  error: string | null

  loadChats: () => Promise<void>
  selectChat: (id: number) => Promise<void>
  newChat: (paperId?: number, title?: string, model?: string) => Promise<AiChatDetailDto>
  send: (content: string) => Promise<void>
  removeChat: (id: number) => Promise<void>
}

export { MODELS }

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  messages: [],
  isLoading: false,
  isSending: false,
  error: null,

  loadChats: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await listChats()
      set({ chats: res.items, isLoading: false })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
    }
  },

  selectChat: async (id: number) => {
    set({ isLoading: true, error: null })
    try {
      const chat = await getChat(id)
      set({ activeChat: chat, messages: chat.messages, isLoading: false })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
    }
  },

  newChat: async (paperId, title, model) => {
    set({ isLoading: true, error: null })
    try {
      const chat = await createChat({
        paperId,
        model: model ?? "gpt-4o-mini",
        title: title ?? "New Chat",
      })
      set((s) => ({
        activeChat: chat,
        messages: chat.messages,
        chats: [{ id: chat.id, title: chat.title, model: chat.model, paperId: chat.paperId, createdAt: chat.createdAt }, ...s.chats],
        isLoading: false,
      }))
      return chat
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
      throw e
    }
  },

  send: async (content: string) => {
    const { activeChat } = get()
    if (!activeChat) return
    const userMsg: AiMessageDto = {
      id: Date.now(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ messages: [...s.messages, userMsg], isSending: true, error: null }))
    try {
      const reply = await sendMessage(activeChat.id, { message: content })
      set((s) => ({ messages: [...s.messages, reply], isSending: false }))
    } catch (e) {
      set({ isSending: false, error: (e as Error).message })
    }
  },

  removeChat: async (id: number) => {
    await deleteChat(id)
    set((s) => ({
      chats: s.chats.filter((c) => c.id !== id),
      activeChat: s.activeChat?.id === id ? null : s.activeChat,
      messages: s.activeChat?.id === id ? [] : s.messages,
    }))
  },
}))

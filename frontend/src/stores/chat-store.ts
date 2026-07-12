"use client"

import { create } from "zustand"
import type { AiChatListDto, AiChatDetailDto, AiMessageDto } from "@/lib/api/types"
import { listChats, getChat, createChat, sendMessage, deleteChat } from "@/lib/api/ai-chats"
import type { AiProvider } from "@/stores/preferences-store"

export interface ChatMessageItem {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  images?: string[]
  createdAt: string
}

const MODELS = ["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-6", "gemini-2.5-pro"] as const

interface ChatState {
  chats: AiChatListDto[]
  activeChat: AiChatDetailDto | null
  messages: ChatMessageItem[]
  isLoading: boolean
  isSending: boolean
  error: string | null

  loadChats: () => Promise<void>
  selectChat: (id: number) => Promise<void>
  newChat: (paperId?: number, title?: string, model?: string) => Promise<AiChatDetailDto>
  send: (content: string) => Promise<void>
  removeChat: (id: number) => Promise<void>

  // Direct provider API
  sendDirect: (content: string, model: string, provider: AiProvider) => Promise<void>
  addDirectMessage: (m: Omit<ChatMessageItem, "id" | "createdAt">) => void
  clearMessages: () => void
  appendStreamChunk: (chunk: string) => void
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
      const msgs: ChatMessageItem[] = chat.messages.map((m) => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }))
      set({ activeChat: chat, messages: msgs, isLoading: false })
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
      const msgs: ChatMessageItem[] = chat.messages.map((m) => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }))
      set((s) => ({
        activeChat: chat,
        messages: msgs,
        chats: [
          { id: chat.id, title: chat.title, model: chat.model, paperId: chat.paperId, createdAt: chat.createdAt },
          ...s.chats,
        ],
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
    const userMsg: ChatMessageItem = {
      id: String(Date.now()),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ messages: [...s.messages, userMsg], isSending: true, error: null }))
    try {
      const reply = await sendMessage(activeChat.id, { message: content })
      const assistantMsg: ChatMessageItem = {
        id: String(reply.id),
        role: reply.role,
        content: reply.content,
        createdAt: reply.createdAt,
      }
      set((s) => ({ messages: [...s.messages, assistantMsg], isSending: false }))
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

  // Direct provider API — streaming chat completions
  sendDirect: async (content: string, model: string, provider: AiProvider) => {
    const { messages } = get()

    const userMsg: ChatMessageItem = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ messages: [...s.messages, userMsg], isSending: true, error: null }))

    const apiMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const baseUrl = provider.baseUrl.replace(/\/+$/, "")

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({ model, messages: apiMessages, stream: true }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`API error ${res.status}: ${errText}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""
      let assistantContent = ""

      set((s) => ({
        messages: [
          ...s.messages,
          { id: crypto.randomUUID(), role: "assistant", content: "", createdAt: new Date().toISOString() },
        ],
      }))

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith("data: ")) continue
          const data = trimmed.slice(6)
          if (data === "[DONE]") break

          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta?.content
            if (delta) {
              assistantContent += delta
              set((s) => {
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last && last.role === "assistant") {
                  msgs[msgs.length - 1] = { ...last, content: assistantContent }
                }
                return { messages: msgs }
              })
            }
          } catch {
            // skip malformed JSON chunks
          }
        }
      }
    } catch (e) {
      set((s) => {
        const msgs = [...s.messages]
        const last = msgs[msgs.length - 1]
        if (last && last.role === "assistant" && !last.content) {
          msgs.pop()
        }
        return { messages: msgs, error: (e as Error).message }
      })
    } finally {
      set({ isSending: false })
    }
  },

  addDirectMessage: (m) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { ...m, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ],
    })),

  clearMessages: () => set({ messages: [], activeChat: null }),

  appendStreamChunk: (chunk) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
      }
      return { messages: msgs }
    }),
}))

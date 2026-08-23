import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { AiChatListDto, AiChatDetailDto } from "@/lib/api/types"
import { listChats, getChat, createChat, sendMessage, deleteChat } from "@/lib/api/ai-chats"
import type { AiProvider } from "@/stores/preferences-store"
import { buildProviderHeaders, normalizeProviderBaseUrl } from "@/lib/ai-provider"

export interface ChatMessageItem {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  images?: string[]
  createdAt: string
}

/**
 * A browser-side conversation backed by the user's configured OpenAI-compatible
 * provider. It is intentionally separate from the server-side AI chat DTOs:
 * the latter use the backend's configured model, while these conversations use
 * the provider and API key selected in the client preferences.
 */
export interface DirectChat {
  id: string
  title: string
  model: string
  providerId: string
  messages: ChatMessageItem[]
  createdAt: string
  updatedAt: string
}

const MODELS = ["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-6", "gemini-2.5-pro"] as const
const DEFAULT_DIRECT_TITLE = "新对话"
const DIRECT_TITLE_LIMIT = 32

interface ChatState {
  chats: AiChatListDto[]
  activeChat: AiChatDetailDto | null
  messages: ChatMessageItem[]
  isLoading: boolean
  isSending: boolean
  error: string | null

  directChats: DirectChat[]
  activeDirectChatId: string | null

  loadChats: () => Promise<void>
  selectChat: (id: number) => Promise<void>
  newChat: (paperId?: number, title?: string, model?: string) => Promise<AiChatDetailDto>
  send: (content: string) => Promise<void>
  removeChat: (id: number) => Promise<void>

  // Direct provider API
  sendDirect: (content: string, model: string, provider: AiProvider) => Promise<void>
  addDirectMessage: (m: Omit<ChatMessageItem, "id" | "createdAt">) => void
  startDirectChat: (model: string, providerId: string) => string
  selectDirectChat: (id: string) => void
  clearMessages: () => void
  appendStreamChunk: (chunk: string) => void
}

export { MODELS }

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createDirectChat(model: string, providerId: string): DirectChat {
  const now = new Date().toISOString()
  return {
    id: createId(),
    title: DEFAULT_DIRECT_TITLE,
    model,
    providerId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

function titleFromMessage(content: string): string {
  const title = content.replace(/\s+/g, " ").trim()
  if (!title) return DEFAULT_DIRECT_TITLE
  return title.length > DIRECT_TITLE_LIMIT
    ? `${title.slice(0, DIRECT_TITLE_LIMIT)}…`
    : title
}

function updateDirectChat(
  chats: DirectChat[],
  chatId: string | null,
  messages: ChatMessageItem[],
  options?: { model?: string; providerId?: string; firstMessage?: string },
): DirectChat[] {
  if (!chatId) return chats

  return chats.map((chat) => {
    if (chat.id !== chatId) return chat
    return {
      ...chat,
      messages,
      model: options?.model ?? chat.model,
      providerId: options?.providerId ?? chat.providerId,
      title:
        chat.title === DEFAULT_DIRECT_TITLE && options?.firstMessage
          ? titleFromMessage(options.firstMessage)
          : chat.title,
      updatedAt: new Date().toISOString(),
    }
  })
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [],
      activeChat: null,
      messages: [],
      isLoading: false,
      isSending: false,
      error: null,
      directChats: [],
      activeDirectChatId: null,

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
          const messages: ChatMessageItem[] = chat.messages.map((message) => ({
            id: String(message.id),
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
          }))
          set({ activeChat: chat, activeDirectChatId: null, messages, isLoading: false })
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
          const messages: ChatMessageItem[] = chat.messages.map((message) => ({
            id: String(message.id),
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
          }))
          set((state) => ({
            activeChat: chat,
            activeDirectChatId: null,
            messages,
            chats: [
              {
                id: chat.id,
                title: chat.title,
                model: chat.model,
                paperId: chat.paperId,
                createdAt: chat.createdAt,
              },
              ...state.chats,
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

        const userMessage: ChatMessageItem = {
          id: String(Date.now()),
          role: "user",
          content,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          messages: [...state.messages, userMessage],
          isSending: true,
          error: null,
        }))
        try {
          const reply = await sendMessage(activeChat.id, { message: content })
          const assistantMessage: ChatMessageItem = {
            id: String(reply.id),
            role: reply.role,
            content: reply.content,
            createdAt: reply.createdAt,
          }
          set((state) => ({
            messages: [...state.messages, assistantMessage],
            isSending: false,
          }))
        } catch (e) {
          set({ isSending: false, error: (e as Error).message })
        }
      },

      removeChat: async (id: number) => {
        await deleteChat(id)
        set((state) => ({
          chats: state.chats.filter((chat) => chat.id !== id),
          activeChat: state.activeChat?.id === id ? null : state.activeChat,
          messages: state.activeChat?.id === id ? [] : state.messages,
        }))
      },

      startDirectChat: (model, providerId) => {
        const chat = createDirectChat(model, providerId)
        set((state) => ({
          directChats: [chat, ...state.directChats],
          activeDirectChatId: chat.id,
          activeChat: null,
          messages: [],
          error: null,
        }))
        return chat.id
      },

      selectDirectChat: (id) => {
        const chat = get().directChats.find((item) => item.id === id)
        if (!chat) return
        set({ activeDirectChatId: chat.id, activeChat: null, messages: chat.messages, error: null })
      },

      // Direct provider API — streaming chat completions
      sendDirect: async (content: string, model: string, provider: AiProvider) => {
        let directChatId = get().activeDirectChatId
        const currentDirectChat = get().directChats.find((chat) => chat.id === directChatId)
        if (
          !directChatId ||
          !currentDirectChat ||
          (currentDirectChat.providerId && currentDirectChat.providerId !== provider.id)
        ) {
          directChatId = get().startDirectChat(model, provider.id)
        }

        const previousMessages = get().messages
        const userMessage: ChatMessageItem = {
          id: createId(),
          role: "user",
          content,
          createdAt: new Date().toISOString(),
        }
        set((state) => {
          const messages = [...state.messages, userMessage]
          return {
            messages,
            isSending: true,
            error: null,
            directChats: updateDirectChat(state.directChats, directChatId, messages, {
              model,
              providerId: provider.id,
              firstMessage: content,
            }),
          }
        })

        const apiMessages = [...previousMessages, userMessage].map((message) => ({
          role: message.role,
          content: message.content,
        }))
        const baseUrl = normalizeProviderBaseUrl(provider.baseUrl)

        try {
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: buildProviderHeaders(provider.apiKey, true),
            body: JSON.stringify({ model, messages: apiMessages, stream: true }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`API error ${response.status}: ${errorText}`)
          }

          const reader = response.body?.getReader()
          if (!reader) throw new Error("No response body")

          const decoder = new TextDecoder()
          let buffer = ""
          let assistantContent = ""

          set((state) => {
            const messages = [
              ...state.messages,
              { id: createId(), role: "assistant" as const, content: "", createdAt: new Date().toISOString() },
            ]
            return {
              messages,
              directChats: updateDirectChat(state.directChats, directChatId, messages),
            }
          })

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
              if (data === "[DONE]") continue

              try {
                const json = JSON.parse(data)
                const delta = json.choices?.[0]?.delta?.content
                if (delta) {
                  assistantContent += delta
                  set((state) => {
                    const messages = [...state.messages]
                    const last = messages[messages.length - 1]
                    if (last && last.role === "assistant") {
                      messages[messages.length - 1] = { ...last, content: assistantContent }
                    }
                    return {
                      messages,
                      directChats: updateDirectChat(state.directChats, directChatId, messages),
                    }
                  })
                }
              } catch {
                // Ignore malformed SSE chunks and continue the stream.
              }
            }
          }
        } catch (e) {
          set((state) => {
            const messages = [...state.messages]
            const last = messages[messages.length - 1]
            if (last && last.role === "assistant" && !last.content) messages.pop()
            return {
              messages,
              directChats: updateDirectChat(state.directChats, directChatId, messages),
              error: (e as Error).message,
            }
          })
        } finally {
          set({ isSending: false })
        }
      },

      addDirectMessage: (message) =>
        set((state) => {
          const messages = [
            ...state.messages,
            { ...message, id: createId(), createdAt: new Date().toISOString() },
          ]
          return {
            messages,
            directChats: updateDirectChat(state.directChats, state.activeDirectChatId, messages),
          }
        }),

      clearMessages: () =>
        set({ messages: [], activeChat: null, activeDirectChatId: null, error: null }),

      appendStreamChunk: (chunk) =>
        set((state) => {
          const messages = [...state.messages]
          const last = messages[messages.length - 1]
          if (last && last.role === "assistant") {
            messages[messages.length - 1] = { ...last, content: last.content + chunk }
          }
          return {
            messages,
            directChats: updateDirectChat(state.directChats, state.activeDirectChatId, messages),
          }
        }),
    }),
    {
      name: "pr-ai-direct-chats",
      partialize: (state) => ({
        directChats: state.directChats,
        activeDirectChatId: state.activeDirectChatId,
        messages: state.messages,
      }),
    },
  ),
)

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { AiChatListDto, AiChatDetailDto } from "@/lib/api/types"
import { listChats, getChat, createChat, sendMessage, deleteChat } from "@/lib/api/ai-chats"
import type { AiProvider } from "@/stores/preferences-store"
import { EmptyAiResponseError } from "@/lib/ai-chat-response"
import {
  describeProviderNetworkError,
  redactProviderErrorText,
  requestAiChatCompletion,
} from "@/lib/ai-provider"

export type ChatMessageStatus = "thinking" | "streaming" | "complete" | "error"

export interface ChatMessageItem {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  images?: string[]
  createdAt: string
  status?: ChatMessageStatus
  statusMessage?: string
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

function updateMessage(
  messages: ChatMessageItem[],
  messageId: string,
  patch: Partial<ChatMessageItem>,
): ChatMessageItem[] {
  return messages.map((message) =>
    message.id === messageId ? { ...message, ...patch } : message,
  )
}

function updateDirectChatMessage(
  chats: DirectChat[],
  chatId: string,
  messageId: string,
  patch: Partial<ChatMessageItem>,
): DirectChat[] {
  return chats.map((chat) => {
    if (chat.id !== chatId) return chat
    return {
      ...chat,
      messages: updateMessage(chat.messages, messageId, patch),
      updatedAt: new Date().toISOString(),
    }
  })
}

function normalizeDirectMessages(
  messages: ChatMessageItem[],
  recoverInterrupted = false,
): ChatMessageItem[] {
  return messages.flatMap((message) => {
    if (message.role !== "assistant") return [message]

    if (message.status === "thinking" || message.status === "streaming") {
      if (!recoverInterrupted) return [message]
      return [{
        ...message,
        status: "error" as const,
        statusMessage: "上一次回复在页面关闭前未完成，请重新发送",
      }]
    }

    if (message.content.trim()) return [message]
    if (message.status === "error" && message.statusMessage) return [message]
    return []
  })
}

function describeDirectChatError(error: unknown, apiKey: string): string {
  if (error instanceof EmptyAiResponseError) return error.message
  const networkMessage = describeProviderNetworkError(error)
  return redactProviderErrorText(networkMessage, apiKey) || "未知错误"
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
        const messages = normalizeDirectMessages(chat.messages)
        set((state) => ({
          activeDirectChatId: chat.id,
          activeChat: null,
          messages,
          error: null,
          directChats: updateDirectChat(state.directChats, chat.id, messages),
        }))
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

        const previousMessages = normalizeDirectMessages(get().messages).filter(
          (message) => message.content.trim() && message.status !== "error",
        )
        const userMessage: ChatMessageItem = {
          id: createId(),
          role: "user",
          content,
          createdAt: new Date().toISOString(),
        }
        const assistantMessage: ChatMessageItem = {
          id: createId(),
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          status: "thinking",
        }
        set((state) => {
          const messages = [
            ...normalizeDirectMessages(state.messages),
            userMessage,
            assistantMessage,
          ]
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
        try {
          const assistantContent = await requestAiChatCompletion({
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            model,
            messages: apiMessages,
            onContent: (nextContent) => {
              set((state) => ({
                messages:
                  state.activeDirectChatId === directChatId
                    ? updateMessage(state.messages, assistantMessage.id, {
                        content: nextContent,
                        status: "streaming",
                        statusMessage: undefined,
                      })
                    : state.messages,
                directChats: updateDirectChatMessage(
                  state.directChats,
                  directChatId,
                  assistantMessage.id,
                  {
                    content: nextContent,
                    status: "streaming",
                    statusMessage: undefined,
                  },
                ),
              }))
            },
          })

          set((state) => ({
            messages:
              state.activeDirectChatId === directChatId
                ? updateMessage(state.messages, assistantMessage.id, {
                    content: assistantContent,
                    status: "complete",
                    statusMessage: undefined,
                  })
                : state.messages,
            directChats: updateDirectChatMessage(
              state.directChats,
              directChatId,
              assistantMessage.id,
              {
                content: assistantContent,
                status: "complete",
                statusMessage: undefined,
              },
            ),
          }))
        } catch (e) {
          const errorMessage = describeDirectChatError(e, provider.apiKey)
          set((state) => {
            const patch: Partial<ChatMessageItem> = {
              status: "error",
              statusMessage: `回复失败：${errorMessage}`,
            }
            return {
              messages:
                state.activeDirectChatId === directChatId
                  ? updateMessage(state.messages, assistantMessage.id, patch)
                  : state.messages,
              directChats: updateDirectChatMessage(
                state.directChats,
                directChatId,
                assistantMessage.id,
                patch,
              ),
              error: errorMessage,
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
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<ChatState>
        const directChats = (persisted.directChats ?? currentState.directChats).map((chat) => ({
          ...chat,
          messages: normalizeDirectMessages(chat.messages, true),
        }))
        const activeDirectChat = directChats.find(
          (chat) => chat.id === persisted.activeDirectChatId,
        )

        return {
          ...currentState,
          ...persisted,
          directChats,
          messages: activeDirectChat
            ? activeDirectChat.messages
            : normalizeDirectMessages(persisted.messages ?? currentState.messages, true),
          isSending: false,
          error: null,
        }
      },
      partialize: (state) => ({
        directChats: state.directChats,
        activeDirectChatId: state.activeDirectChatId,
        messages: state.messages,
      }),
    },
  ),
)
